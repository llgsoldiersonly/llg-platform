import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { fetchPsi } from '@/lib/integrations/psi'
import { getGmbInfo } from '@/lib/integrations/dataforseo/gmb'
import {
  getBacklinkSummary,
  getCurrentMonthNewLostCounts,
  getNewBacklinkRowsForMonth,
  getLostBacklinkRowsForMonth,
} from '@/lib/integrations/dataforseo/backlinks'
import {
  saveBacklinkSummarySnapshot,
  saveBacklinkRows,
  saveGmbInfoSnapshot,
  monthBounds,
  todayMonthKey,
} from '@/lib/integrations/dataforseo/snapshots'
import { fetchCallRailCalls } from '@/lib/integrations/callrail'

// On-demand "Pull latest data" for one client — staff/admin only. Runs the same
// work the scheduled crons do (backlinks + site health per site, GBP per
// location, CallRail), but scoped to a single client and triggered by a button,
// so a freshly-created client isn't blank until the next cron. Each section is
// best-effort and isolated, so one failing integration doesn't block the rest.
//
// POST /api/admin/refresh-client-data?clientId=<uuid>
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAgencyStaff(user)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'missing clientId param' }, { status: 400 })
  }

  const supa = createAdminClient()
  const { data: client } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) {
    return NextResponse.json({ ok: false, error: 'client not found' }, { status: 404 })
  }

  const { data: sitesData } = await supa
    .from('client_sites')
    .select('id, domain, is_primary')
    .eq('client_id', clientId)
    .eq('is_active', true)
  const sites: Array<{ id: string | null; domain: string }> =
    (sitesData ?? []).length > 0
      ? (sitesData ?? [])
      : client.primary_domain
        ? [{ id: null, domain: client.primary_domain }]
        : []

  const errors: Array<{ stage: string; message: string }> = []
  const monthKey = todayMonthKey()
  const { monthStart, nextMonthStart } = monthBounds()
  const today = new Date().toISOString().slice(0, 10)
  let backlinkRows = 0
  let siteHealthAudits = 0
  let gbpLocations = 0
  let calls = 0

  const hasDfs = !!process.env.DATAFORSEO_API_KEY || (!!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD)

  // ---- Backlinks + Site health, per site ----
  for (const site of sites) {
    if (hasDfs) {
      try {
        const [summary, mtd, newRows, lostRows] = await Promise.all([
          getBacklinkSummary(site.domain, { client_id: client.id }),
          getCurrentMonthNewLostCounts(site.domain, { client_id: client.id }),
          getNewBacklinkRowsForMonth(site.domain, monthStart, nextMonthStart, 500, { client_id: client.id }),
          getLostBacklinkRowsForMonth(site.domain, monthStart, nextMonthStart, 500, { client_id: client.id }),
        ])
        await saveBacklinkSummarySnapshot(supa, { clientId: client.id, siteId: site.id, summary, mtdCounts: mtd })
        const newItems = ((newRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
        const lostItems = ((lostRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
        await saveBacklinkRows(supa, { clientId: client.id, siteId: site.id, monthKey, status: 'new', items: newItems })
        await saveBacklinkRows(supa, { clientId: client.id, siteId: site.id, monthKey, status: 'lost', items: lostItems })
        backlinkRows += newItems.length + lostItems.length
      } catch (e) {
        errors.push({ stage: `backlinks:${site.domain}`, message: e instanceof Error ? e.message : 'unknown' })
      }
    }

    if (process.env.PSI_API_KEY) {
      for (const strategy of ['mobile', 'desktop'] as const) {
        try {
          const url = `https://${site.domain}/`
          const psi = await fetchPsi({ apiKey: process.env.PSI_API_KEY, url, strategy })
          const crux = {
            crux_lcp_ms: psi.crux.lcp_ms,
            crux_inp_ms: psi.crux.inp_ms,
            crux_cls: psi.crux.cls,
            crux_fcp_ms: psi.crux.fcp_ms,
            crux_category: psi.crux.category,
          }
          await supa.from('raw_lighthouse').insert({
            client_id: client.id,
            site_id: site.id,
            url,
            strategy,
            performance: psi.performance,
            seo: psi.seo,
            accessibility: psi.accessibility,
            best_practices: psi.best_practices,
            lcp_ms: psi.lcp_ms != null ? Math.round(psi.lcp_ms) : null,
            fid_ms: psi.fid_ms != null ? Math.round(psi.fid_ms) : null,
            cls: psi.cls,
            opportunities: psi.opportunities,
            ...crux,
            captured_at: new Date().toISOString(),
          })
          await supa.from('site_health').upsert(
            {
              client_id: client.id,
              site_id: site.id,
              url,
              strategy,
              performance: psi.performance,
              seo: psi.seo,
              accessibility: psi.accessibility,
              best_practices: psi.best_practices,
              lcp_ms: psi.lcp_ms != null ? Math.round(psi.lcp_ms) : null,
              fid_ms: psi.fid_ms != null ? Math.round(psi.fid_ms) : null,
              cls: psi.cls,
              ...crux,
              captured_on: today,
            },
            { onConflict: 'client_id,url,strategy,captured_on' }
          )
          siteHealthAudits += 1
        } catch (e) {
          errors.push({ stage: `site_health:${site.domain}:${strategy}`, message: e instanceof Error ? e.message : 'unknown' })
        }
      }
    }
  }

  // ---- GBP, per location ----
  if (hasDfs) {
    const { data: locations } = await supa
      .from('client_locations')
      .select('id, label, gbp_place_id, lat, lng')
      .eq('client_id', client.id)
    for (const loc of locations ?? []) {
      if (loc.lat == null || loc.lng == null) {
        errors.push({ stage: `gbp:${loc.label}`, message: 'No lat/lng on location' })
        continue
      }
      try {
        const info = await getGmbInfo(
          {
            firmName: client.firm_name,
            placeId: loc.gbp_place_id,
            primaryDomain: client.primary_domain,
            lat: Number(loc.lat),
            lng: Number(loc.lng),
          },
          { client_id: client.id }
        )
        if (!info) {
          errors.push({ stage: `gbp:${loc.label}`, message: 'No GMB match in Maps results' })
          continue
        }
        const { data: prior } = await supa
          .from('gmb_snapshots')
          .select('posts_30d')
          .eq('client_id', client.id)
          .eq('location_id', loc.id)
          .order('captured_on', { ascending: false })
          .limit(1)
          .maybeSingle()
        await saveGmbInfoSnapshot(supa, {
          clientId: client.id,
          locationId: loc.id,
          info,
          updatesCount: prior?.posts_30d ?? 0,
        })
        gbpLocations += 1
      } catch (e) {
        errors.push({ stage: `gbp:${loc.label}`, message: e instanceof Error ? e.message : 'unknown' })
      }
    }
  }

  // ---- Calls (CallRail) ----
  if (process.env.CALLRAIL_API_TOKEN) {
    const { data: creds } = await supa
      .from('client_credentials')
      .select('callrail_account_id, callrail_company_id')
      .eq('client_id', client.id)
      .maybeSingle()
    const accountId = creds?.callrail_account_id ?? process.env.CALLRAIL_DEFAULT_ACCOUNT_ID
    if (!accountId || !creds?.callrail_company_id) {
      errors.push({ stage: 'calls', message: 'CallRail account_id / company_id not set in Credentials' })
    } else {
      try {
        const fetched = await fetchCallRailCalls({
          apiToken: process.env.CALLRAIL_API_TOKEN,
          accountId,
          companyId: creds.callrail_company_id,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        })
        if (fetched.length > 0) {
          const rawRows = fetched.map((c) => ({
            client_id: client.id,
            call_id: c.id,
            duration: c.duration,
            source: c.source ?? c.source_name,
            tracker: c.tracker,
            recording_url: c.recording,
            caller_name: c.customer_name,
            caller_number: c.customer_phone_number,
            first_call: c.first_call,
            agent_email: c.agent_email,
            started_at: c.start_time ? new Date(c.start_time).toISOString() : null,
            tags: c.tags ?? [],
            ai_summary: c.ai_summary ?? null,
            lead_score: c.lead_score ?? null,
            raw_json: c,
            fetched_at: new Date().toISOString(),
          }))
          await supa.from('raw_callrail').upsert(rawRows, { onConflict: 'client_id,call_id' })
          const normRows = fetched.map((c) => ({
            client_id: client.id,
            external_id: c.id,
            duration: c.duration,
            source: c.source ?? c.source_name,
            tracker: c.tracker,
            recording_url: c.recording,
            caller_name: c.customer_name,
            caller_number: c.customer_phone_number,
            first_call: c.first_call,
            agent_email: c.agent_email,
            started_at: c.start_time ? new Date(c.start_time).toISOString() : null,
            tags: c.tags ?? [],
            ai_summary: c.ai_summary ?? null,
            lead_score: c.lead_score ?? null,
          }))
          await supa.from('calls').upsert(normRows, { onConflict: 'client_id,external_id' })
        }
        calls = fetched.length
      } catch (e) {
        errors.push({ stage: 'calls', message: e instanceof Error ? e.message : 'unknown' })
      }
    }
  }

  await supa.from('sync_log').insert({
    source: 'manual:refresh-client-data',
    client_id: client.id,
    status: errors.length > 0 ? (backlinkRows + siteHealthAudits + gbpLocations + calls > 0 ? 'partial' : 'error') : 'ok',
    row_count: backlinkRows + siteHealthAudits + gbpLocations + calls,
    error_message: errors.length > 0 ? `${errors.length} issue(s); first: ${errors[0].stage} — ${errors[0].message}` : null,
  })

  return NextResponse.json({
    ok: true,
    client: { id: client.id, firm_name: client.firm_name },
    results: {
      sites_processed: sites.length,
      backlink_rows: backlinkRows,
      site_health_audits: siteHealthAudits,
      gbp_locations: gbpLocations,
      calls,
    },
    errors,
  })
}
