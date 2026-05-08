import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getReputationManagerResults } from '@/lib/integrations/brightlocal'
import { postToGlip } from '@/lib/integrations/ringcentral'

// Daily 02:40 UTC. Pulls review data from BrightLocal Reputation Manager
// for each location's brightlocal_reputation_report_id. Upserts raw_reviews
// and the deduped reviews table; recomputes review_summary daily snapshot.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.BRIGHTLOCAL_API_KEY) {
    return NextResponse.json({ ok: false, error: 'BRIGHTLOCAL_API_KEY not configured' }, { status: 503 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  let totalReviews = 0
  const errors: Array<{ location: string; message: string }> = []

  const { data: locations } = await supa
    .from('client_locations')
    .select('id, client_id, label, brightlocal_reputation_report_id')
    .not('brightlocal_reputation_report_id', 'is', null)

  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  for (const loc of locations ?? []) {
    if (!loc.brightlocal_reputation_report_id) continue

    try {
      const reviews = await getReputationManagerResults(
        process.env.BRIGHTLOCAL_API_KEY!,
        loc.brightlocal_reputation_report_id
      )

      if (reviews.length > 0) {
        // Upsert raw_reviews (dedupe via unique constraint on directory + external_review_id)
        const rawRows = reviews.map((r) => ({
          client_id: loc.client_id,
          location_id: loc.id,
          directory: r.directory,
          external_review_id: r.external_review_id,
          reviewer_name: r.reviewer_name,
          rating: r.rating,
          review_text: r.review_text,
          review_date: r.review_date,
          response_text: r.response_text,
          response_date: r.response_date,
          review_url: r.review_url,
          raw_json: r.raw,
          captured_at: new Date().toISOString(),
        }))
        await supa.from('raw_reviews').upsert(rawRows, {
          onConflict: 'directory,external_review_id',
          ignoreDuplicates: false,
        })

        // Mirror to deduped reviews table with sentiment + responded flags
        const normRows = reviews.map((r) => ({
          client_id: loc.client_id,
          location_id: loc.id,
          directory: r.directory,
          external_review_id: r.external_review_id,
          reviewer_name: r.reviewer_name,
          rating: r.rating,
          review_text: r.review_text,
          review_date: r.review_date,
          response_text: r.response_text,
          response_date: r.response_date,
          review_url: r.review_url,
          sentiment:
            r.rating != null ? (r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral') : null,
          responded: !!r.response_text,
        }))
        await supa.from('reviews').upsert(normRows, {
          onConflict: 'directory,external_review_id',
        })
        totalReviews += reviews.length
      }

      // Recompute review_summary snapshot per directory for this location
      const directories = Array.from(new Set(reviews.map((r) => r.directory)))
      for (const dir of directories) {
        const dirReviews = reviews.filter((r) => r.directory === dir)
        const ratings = dirReviews.map((r) => r.rating).filter((x): x is number => typeof x === 'number')
        const avg = ratings.length > 0 ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null
        const count30 = dirReviews.filter((r) => r.review_date && new Date(r.review_date) >= thirtyDaysAgo).length
        const count7 = dirReviews.filter((r) => r.review_date && new Date(r.review_date) >= sevenDaysAgo).length
        const unanswered = dirReviews.filter((r) => !r.response_text).length

        await supa.from('review_summary').upsert(
          {
            client_id: loc.client_id,
            location_id: loc.id,
            directory: dir,
            avg_rating: avg,
            review_count: dirReviews.length,
            reviews_30d: count30,
            reviews_7d: count7,
            unanswered_count: unanswered,
            captured_on: today,
          },
          { onConflict: 'client_id,location_id,directory,captured_on' }
        )
      }

      await supa.from('sync_log').insert({
        source: 'cron:reviews',
        client_id: loc.client_id,
        status: 'ok',
        row_count: reviews.length,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ location: loc.label, message })
      await supa.from('sync_log').insert({
        source: 'cron:reviews',
        client_id: loc.client_id,
        status: 'error',
        error_message: message,
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ Reviews cron had ${errors.length} error(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    locations_processed: (locations ?? []).length,
    reviews_synced: totalReviews,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
