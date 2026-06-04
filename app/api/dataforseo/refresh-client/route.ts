import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import {
  getBacklinkSummary,
  getCurrentMonthNewLostCounts,
  getNewBacklinkRowsForMonth,
  getLostBacklinkRowsForMonth,
} from '@/lib/integrations/dataforseo/backlinks'
import {
  saveBacklinkSummarySnapshot,
  saveBacklinkRows,
  monthBounds,
  todayMonthKey,
} from '@/lib/integrations/dataforseo/snapshots'

// Staff-callable on-demand refresh for a single client. Mirrors the backlinks
// portion of the weekly cron but for one client at a time — used by admin UI
// "Refresh now" buttons and during testing.
//
// POST /api/dataforseo/refresh-client?clientId=<uuid>
//
// Skips SERP / map grid for now to keep the response under serverless time
// budgets — those run in the weekly cron. If you need them on-demand for one
// client, call the cron with the cron secret and let it process.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAgencyStaff(user)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'missing clientId param' }, { status: 400 })
  }

  const supa = createAdminClient()
  const { data: client, error } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .eq('id', clientId)
    .single()

  if (error || !client) {
    return NextResponse.json({ ok: false, error: 'client not found' }, { status: 404 })
  }
  if (!client.primary_domain) {
    return NextResponse.json(
      { ok: false, error: 'client has no primary_domain set' },
      { status: 400 }
    )
  }

  const monthKey = todayMonthKey()
  const { monthStart, nextMonthStart } = monthBounds()

  // Active tracked websites (post-0029 always ≥1); fall back to primary_domain.
  const { data: clientSites } = await supa
    .from('client_sites')
    .select('id, domain, is_primary')
    .eq('client_id', client.id)
    .eq('is_active', true)
  const siteList: Array<{ id: string | null; domain: string; is_primary: boolean }> =
    (clientSites ?? []).length > 0
      ? (clientSites ?? [])
      : [{ id: null, domain: client.primary_domain, is_primary: true }]

  try {
    let newSaved = 0
    let lostSaved = 0
    for (const site of siteList) {
      const [summary, mtdCounts, newRows, lostRows] = await Promise.all([
        getBacklinkSummary(site.domain, { client_id: client.id }),
        getCurrentMonthNewLostCounts(site.domain, { client_id: client.id }),
        getNewBacklinkRowsForMonth(site.domain, monthStart, nextMonthStart, 500, {
          client_id: client.id,
        }),
        getLostBacklinkRowsForMonth(site.domain, monthStart, nextMonthStart, 500, {
          client_id: client.id,
        }),
      ])

      await saveBacklinkSummarySnapshot(supa, {
        clientId: client.id,
        siteId: site.id,
        summary,
        mtdCounts,
      })
      const newItems = ((newRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
      const lostItems = ((lostRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
      await saveBacklinkRows(supa, { clientId: client.id, siteId: site.id, monthKey, status: 'new', items: newItems })
      await saveBacklinkRows(supa, { clientId: client.id, siteId: site.id, monthKey, status: 'lost', items: lostItems })
      newSaved += newItems.length
      lostSaved += lostItems.length
    }

    await supa.from('sync_log').insert({
      source: 'manual:dataforseo-refresh-client',
      client_id: client.id,
      status: 'ok',
      row_count: newSaved + lostSaved,
    })

    return NextResponse.json({
      ok: true,
      client: { id: client.id, firm_name: client.firm_name },
      backlinks: {
        sites_processed: siteList.length,
        new_rows_saved: newSaved,
        lost_rows_saved: lostSaved,
        summary_snapshot_at: new Date().toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    await supa.from('sync_log').insert({
      source: 'manual:dataforseo-refresh-client',
      client_id: client.id,
      status: 'error',
      error_message: message,
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
