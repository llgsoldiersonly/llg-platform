import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { snapshotMonthFor } from '@/lib/dates'

// Monthly snapshot cron — runs at 00:00 UTC on the 1st of each month.
// Captures KPI snapshot for the *previous* full month per client; one
// row per (client_id, snapshot_month) into monthly_snapshots. Idempotent:
// upserts on the unique (client_id, snapshot_month) constraint.
//
// Fields captured here are best-effort: where the source data exists we
// fill it; otherwise we leave the column null. As more data sources come
// online (Google Ads, GBP API), backfill will populate the gaps.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const start = Date.now()

  // Snapshot month = first day of the month that just ended (extracted to
  // lib/dates so we can unit-test year-rollover edge cases).
  const { monthStartIso, monthEndExclusiveIso, monthEndExclusiveTsIso, yearStartIso } =
    snapshotMonthFor(new Date())

  const { data: clients } = await supa
    .from('clients')
    .select('id, firm_name')
    .neq('status', 'churned')
    .eq('is_demo_only', false)

  const targets = clients ?? []
  let captured = 0
  const errors: Array<{ client: string; message: string }> = []

  for (const client of targets) {
    try {
      const [
        rankingsRes,
        callsRes,
        citationsRes,
        gmbRes,
        socialMonthRes,
        socialYtdRes,
      ] = await Promise.all([
        supa
          .from('rankings_daily')
          .select('keyword, position')
          .eq('client_id', client.id)
          .gte('captured_on', monthStartIso)
          .lt('captured_on', monthEndExclusiveIso),
        supa
          .from('calls')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .gte('started_at', monthStartIso)
          .lt('started_at', monthEndExclusiveTsIso),
        supa
          .from('citations')
          .select('health_score, captured_on')
          .eq('client_id', client.id)
          .lte('captured_on', monthEndExclusiveIso)
          .order('captured_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supa
          .from('gmb_snapshots')
          .select('rating, review_count, posts_30d, captured_on')
          .eq('client_id', client.id)
          .lte('captured_on', monthEndExclusiveIso)
          .order('captured_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supa
          .from('social_stats')
          .select('posts_count, followers')
          .eq('client_id', client.id)
          .gte('period_start', monthStartIso)
          .lt('period_start', monthEndExclusiveIso),
        supa
          .from('social_stats')
          .select('ad_spend_cents')
          .eq('client_id', client.id)
          .gte('period_start', yearStartIso)
          .lt('period_start', monthEndExclusiveIso),
      ])

      const rankings = rankingsRes.data ?? []
      const distinctKeywords = new Set(rankings.map((r) => r.keyword))
      const positions = rankings.map((r) => r.position).filter((p): p is number => p != null)
      const avgPosition = positions.length > 0
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : null
      const top10 = new Set(
        rankings.filter((r) => r.position != null && r.position <= 10).map((r) => r.keyword)
      ).size

      const social = socialMonthRes.data ?? []
      const socialPostsMonth = social.reduce((sum, r) => sum + (r.posts_count ?? 0), 0)
      const socialFollowers = social.reduce((sum, r) => sum + (r.followers ?? 0), 0)

      const adSpendYtd = (socialYtdRes.data ?? []).reduce(
        (sum, r) => sum + (r.ad_spend_cents ?? 0),
        0
      )

      const snapshot = {
        client_id: client.id,
        snapshot_month: monthStartIso,
        rankings_count: distinctKeywords.size > 0 ? distinctKeywords.size : null,
        rankings_avg_position: avgPosition,
        rankings_top10_count: top10 > 0 ? top10 : null,
        citation_score: citationsRes.data?.health_score ?? null,
        gmb_rating: gmbRes.data?.rating ?? null,
        gmb_review_count: gmbRes.data?.review_count ?? null,
        gmb_post_count: gmbRes.data?.posts_30d ?? null,
        ad_spend_ytd_cents: adSpendYtd > 0 ? adSpendYtd : null,
        conversions_ytd: null,                                // wire when Google Ads ships
        call_count_month: callsRes.count ?? 0,
        social_posts_month: socialPostsMonth > 0 ? socialPostsMonth : null,
        social_followers_total: socialFollowers > 0 ? socialFollowers : null,
        captured_at: new Date().toISOString(),
      }

      await supa.from('monthly_snapshots').upsert(snapshot, {
        onConflict: 'client_id,snapshot_month',
      })

      captured++
      await supa.from('sync_log').insert({
        source: 'cron:monthly-snapshot',
        client_id: client.id,
        status: 'ok',
        row_count: 1,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ client: client.firm_name, message })
      await supa.from('sync_log').insert({
        source: 'cron:monthly-snapshot',
        client_id: client.id,
        status: 'error',
        error_message: message,
        error_stack: e instanceof Error ? e.stack : null,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    snapshot_month: monthStartIso,
    clients_processed: targets.length,
    snapshots_captured: captured,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
