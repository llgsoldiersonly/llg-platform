import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import { generateMonthlyReport } from '@/lib/seo/monthly-report-generator'

export const maxDuration = 300

// Monthly SEO report finalizer — runs 1st @ 02:00 UTC, after the AI visibility
// cron (01:00 UTC) so the latest snapshot is included in the scoring.
//
// For each active firm:
//   1. Compute the 6 sub-scores from the prior month's rank / map / AI / review data
//   2. Diff against the previous report row to derive wins / losses
//   3. Call Claude to draft a 4-sentence executive summary
//   4. Upsert one row into dfs_seo_monthly_reports (unique on client_id × month_key)
//
// Idempotency: month_key is derived from the cron's run date — the unique
// constraint on (client_id, month_key) means a same-day re-run replaces the
// row rather than duplicating. Account managers can edit the row directly
// after the cron writes it.
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
  const monthKey = monthKeyForReport(new Date())
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
      const report = await generateMonthlyReport(supa, client.id, monthKey)

      const { error: upsertErr } = await supa
        .from('dfs_seo_monthly_reports')
        .upsert(
          {
            client_id: client.id,
            month_key: monthKey,
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
          },
          { onConflict: 'client_id,month_key' }
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
        text: `⚠️ Monthly report cron — ${errors.length} error(s) across ${stats.clients_processed} client(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    month_key: monthKey,
    stats,
    errors: errors.slice(0, 20),
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST

// The report finalizes data for the month that just ended — when the cron
// fires on the 1st, we want the prior month's `month_key`.
function monthKeyForReport(now: Date): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-11; if now is May 1st, month=4 means "May"
  const lastMonth = new Date(Date.UTC(year, month - 1, 1))
  return lastMonth.toISOString().slice(0, 7)
}
