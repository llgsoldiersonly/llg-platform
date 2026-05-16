import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import { generateWeeklyReport } from '@/lib/seo/weekly-report-generator'

export const maxDuration = 300

// Weekly SEO report finalizer — runs Mondays @ 05:00 UTC, an hour after
// /api/cron/dataforseo-weekly-refresh (04:00 UTC) so the underlying SERP /
// map-grid / GBP snapshots are fresh.
//
// For each active firm:
//   1. Compute the 6 sub-scores from snapshots in the just-ended ISO week
//      (Monday → Sunday).
//   2. Diff against the prior week's report row to derive wins / losses.
//   3. Call Claude for a 4-sentence executive summary + 3-5 key_points bullets.
//   4. Snapshot the latest monthly report's executive_summary into
//      last_month_recap.
//   5. Upsert one row into dfs_seo_weekly_reports (unique on client_id × week_key).
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY not configured.' },
      { status: 503 }
    )
  }

  const supa = createAdminClient()
  const start = Date.now()
  const { weekKey, periodStart, periodEnd } = getReportWeek(new Date())
  const errors: Array<{ client: string; message: string }> = []
  const stats = { clients_processed: 0, reports_written: 0 }

  const { data: clients, error: clientsErr } = await supa
    .from('clients')
    .select('id, firm_name')
    .eq('status', 'active')
    .eq('is_demo_only', false)

  if (clientsErr) {
    return NextResponse.json({ ok: false, error: clientsErr.message }, { status: 500 })
  }

  for (const client of clients ?? []) {
    try {
      stats.clients_processed += 1
      const report = await generateWeeklyReport(supa, client.id, weekKey, periodStart, periodEnd)

      const { error: upsertErr } = await supa
        .from('dfs_seo_weekly_reports')
        .upsert(
          {
            client_id: client.id,
            week_key: weekKey,
            period_start: periodStart,
            period_end: periodEnd,
            search_visibility_score: report.search_visibility_score,
            maps_score: report.maps_score,
            organic_score: report.organic_score,
            ai_visibility_score: report.ai_visibility_score,
            review_score: report.review_score,
            competitor_gap_score: report.competitor_gap_score,
            wins: report.wins,
            losses: report.losses,
            recommended_actions: report.recommended_actions,
            executive_summary: report.executive_summary,
            key_points: report.key_points,
            last_month_recap: report.last_month_recap,
          },
          { onConflict: 'client_id,week_key' }
        )
      if (upsertErr) throw upsertErr

      stats.reports_written += 1
    } catch (e) {
      errors.push({
        client: client.firm_name,
        message: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ Weekly report cron — ${errors.length} error(s) across ${stats.clients_processed} client(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    week_key: weekKey,
    period_start: periodStart,
    period_end: periodEnd,
    stats,
    errors: errors.slice(0, 20),
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST

// Returns the week_key + period bounds for the ISO week that just ended.
// Called Monday morning → resolves to last Monday through last Sunday.
function getReportWeek(now: Date): { weekKey: string; periodStart: string; periodEnd: string } {
  // JS getUTCDay: Sunday=0, Monday=1, …, Saturday=6.
  // ISO weekday:   Monday=1, Tuesday=2, …, Sunday=7.
  // Days back to the most recent Sunday (yesterday for a Monday run):
  const dow = now.getUTCDay()
  const daysToLastSunday = dow === 0 ? 7 : dow
  const periodEnd = new Date(now)
  periodEnd.setUTCDate(now.getUTCDate() - daysToLastSunday)
  periodEnd.setUTCHours(0, 0, 0, 0)
  const periodStart = new Date(periodEnd)
  periodStart.setUTCDate(periodEnd.getUTCDate() - 6)

  return {
    weekKey: isoWeekKey(periodEnd),
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  }
}

// Standard ISO 8601 week computation, given any date in the target week.
// Returns 'YYYY-Www' (week zero-padded to 2 digits).
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Move to the Thursday of the current week — the ISO year owner.
  const dayNum = (d.getUTCDay() + 6) % 7 // Monday=0 … Sunday=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3)
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
