import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import {
  listReadyReviewsTasks,
  getReviewsTaskResults,
  submitReviewsTask,
  parseReviewsTag,
  type ReviewItem,
} from '@/lib/integrations/dataforseo/reviews'

// Daily 02:40 UTC. Two phases per run:
//   COLLECT: pull ready DataForSEO reviews tasks (tag prefix 'reviews:'),
//            parse client_id+location_id from tag, upsert raw_reviews +
//            reviews + review_summary.
//   SUBMIT:  for each active client_location with gbp_place_id whose latest
//            successful task_post in dfs_usage_log is >7 days old (or never),
//            and which has no in-flight task_post in the last 24 hours,
//            submit a new reviews task. The next run picks up the result.
//
// Replaces the previous BrightLocal Reputation Manager flow — that module is
// not on the Track-tier plan, so the prior cron silently no-op'd (no
// client_locations had brightlocal_reputation_report_id set).

const STALE_DAYS = 7
const INFLIGHT_HOURS = 24
const TASK_POST_ENDPOINT = '/business_data/google/reviews/task_post'

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const hasApiKey = !!process.env.DATAFORSEO_API_KEY
  const hasLoginPair = !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD
  if (!hasApiKey && !hasLoginPair) {
    return NextResponse.json(
      { ok: false, error: 'DataForSEO credentials not configured.' },
      { status: 503 }
    )
  }

  const supa = createAdminClient()
  const start = Date.now()
  const errors: Array<{ scope: string; message: string }> = []
  const stats = { tasks_collected: 0, reviews_upserted: 0, tasks_submitted: 0, locations_eligible: 0 }

  // -------- COLLECT --------
  let ready: Awaited<ReturnType<typeof listReadyReviewsTasks>> = []
  try {
    ready = await listReadyReviewsTasks()
  } catch (e) {
    errors.push({ scope: 'tasks_ready', message: e instanceof Error ? e.message : 'unknown' })
  }
  const ours = ready.filter((t) => (t.tag ?? '').startsWith('reviews:'))

  for (const task of ours) {
    const parsed = parseReviewsTag(task.tag)
    if (!parsed) continue
    try {
      const result = await getReviewsTaskResults(task.id, {
        client_id: parsed.clientId,
        tag: task.tag,
      })
      stats.tasks_collected += 1

      const upserted = await persistReviews(supa, {
        clientId: parsed.clientId,
        locationId: parsed.locationId,
        items: result.items,
      })
      stats.reviews_upserted += upserted

      await supa.from('sync_log').insert({
        source: 'cron:reviews',
        client_id: parsed.clientId,
        status: 'ok',
        row_count: upserted,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ scope: `task_get:${task.id}`, message })
      await supa.from('sync_log').insert({
        source: 'cron:reviews',
        client_id: parsed.clientId,
        status: 'error',
        error_message: `task_get ${task.id}: ${message}`,
      })
    }
  }

  // -------- SUBMIT --------
  const { data: locations } = await supa
    .from('client_locations')
    .select('id, client_id, label, gbp_place_id, state, country, lat, lng, clients(firm_name, status, is_demo_only)')
    .not('gbp_place_id', 'is', null)

  const eligible = (locations ?? []).filter((l) => {
    const c = l.clients as { firm_name?: string; status?: string; is_demo_only?: boolean } | null
    return c?.status === 'active' && !c?.is_demo_only
  })
  stats.locations_eligible = eligible.length

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const inflightCutoff = new Date(Date.now() - INFLIGHT_HOURS * 60 * 60 * 1000).toISOString()

  for (const loc of eligible) {
    if (!loc.gbp_place_id) continue
    const tag = `reviews:${loc.client_id}:${loc.id}`

    // Skip if a task_post for this tag landed in the last INFLIGHT_HOURS — it's
    // either in flight or just collected this run; either way, don't double-submit.
    const { data: recentPosts } = await supa
      .from('dfs_usage_log')
      .select('id')
      .eq('endpoint', TASK_POST_ENDPOINT)
      .eq('request_tag', tag)
      .gte('created_at', inflightCutoff)
      .limit(1)
    if ((recentPosts ?? []).length > 0) continue

    // Skip if we already have fresh reviews for this location (last STALE_DAYS).
    const { data: freshRaw } = await supa
      .from('raw_reviews')
      .select('id')
      .eq('client_id', loc.client_id)
      .eq('location_id', loc.id)
      .gte('captured_at', staleCutoff)
      .limit(1)
    if ((freshRaw ?? []).length > 0) continue

    const locationName = loc.state ? `${loc.state},${loc.country ?? 'United States'}` : 'United States'

    try {
      await submitReviewsTask(
        {
          clientId: loc.client_id,
          locationId: loc.id,
          placeId: loc.gbp_place_id,
          locationName,
          depth: 20,
          sortBy: 'newest',
        },
        { client_id: loc.client_id }
      )
      stats.tasks_submitted += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      const c = loc.clients as { firm_name?: string } | null
      errors.push({ scope: `submit:${c?.firm_name ?? loc.client_id}:${loc.label}`, message })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ Reviews cron — ${errors.length} error(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    stats,
    errors: errors.slice(0, 20),
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

type AdminSupabase = ReturnType<typeof createAdminClient>

async function persistReviews(
  supa: AdminSupabase,
  args: { clientId: string; locationId: string | null; items: ReviewItem[] }
): Promise<number> {
  if (args.items.length === 0) return 0
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const directory = 'google'

  const rawRows = args.items.map((r) => ({
    client_id: args.clientId,
    location_id: args.locationId,
    directory,
    external_review_id: r.review_id ?? null,
    reviewer_name: r.reviewer?.name ?? null,
    rating: r.rating?.value ?? null,
    review_text: r.text ?? null,
    review_date: r.timestamp ? r.timestamp.slice(0, 10) : null,
    response_text: r.owner_answer?.text ?? null,
    response_date: r.owner_answer?.timestamp ? r.owner_answer.timestamp.slice(0, 10) : null,
    review_url: r.url ?? null,
    raw_json: r.raw,
    captured_at: new Date().toISOString(),
  }))
  await supa.from('raw_reviews').upsert(rawRows, {
    onConflict: 'directory,external_review_id',
    ignoreDuplicates: false,
  })

  const normRows = args.items.map((r) => {
    const rating = r.rating?.value ?? null
    return {
      client_id: args.clientId,
      location_id: args.locationId,
      directory,
      external_review_id: r.review_id ?? null,
      reviewer_name: r.reviewer?.name ?? null,
      rating,
      review_text: r.text ?? null,
      review_date: r.timestamp ? r.timestamp.slice(0, 10) : null,
      response_text: r.owner_answer?.text ?? null,
      response_date: r.owner_answer?.timestamp ? r.owner_answer.timestamp.slice(0, 10) : null,
      review_url: r.url ?? null,
      sentiment: rating != null ? (rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral') : null,
      responded: !!r.owner_answer?.text,
    }
  })
  await supa.from('reviews').upsert(normRows, { onConflict: 'directory,external_review_id' })

  const ratings = args.items
    .map((r) => r.rating?.value)
    .filter((x): x is number => typeof x === 'number')
  const avg = ratings.length > 0 ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null
  const count30 = args.items.filter(
    (r) => r.timestamp && new Date(r.timestamp) >= thirtyDaysAgo
  ).length
  const count7 = args.items.filter(
    (r) => r.timestamp && new Date(r.timestamp) >= sevenDaysAgo
  ).length
  const unanswered = args.items.filter((r) => !r.owner_answer?.text).length

  await supa.from('review_summary').upsert(
    {
      client_id: args.clientId,
      location_id: args.locationId,
      directory,
      avg_rating: avg,
      review_count: args.items.length,
      reviews_30d: count30,
      reviews_7d: count7,
      unanswered_count: unanswered,
      captured_on: today,
    },
    { onConflict: 'client_id,location_id,directory,captured_on' }
  )

  return args.items.length
}

export const GET = POST
