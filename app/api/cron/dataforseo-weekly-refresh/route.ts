import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import {
  getBacklinkSummary,
  getCurrentMonthNewLostCounts,
  getNewBacklinkRowsForMonth,
  getLostBacklinkRowsForMonth,
} from '@/lib/integrations/dataforseo/backlinks'
import { getGoogleOrganicRank } from '@/lib/integrations/dataforseo/serp'
import { getGoogleLocalFinderRank, getGoogleMapsRankAtPoint } from '@/lib/integrations/dataforseo/local'
import { getGmbInfo, getGmbUpdates, gmbUpdateExternalId } from '@/lib/integrations/dataforseo/gmb'
import {
  saveBacklinkSummarySnapshot,
  saveBacklinkRows,
  saveKeywordRankSnapshot,
  saveMapGridRankSnapshot,
  saveGmbInfoSnapshot,
  saveGmbUpdates,
  monthBounds,
  todayMonthKey,
} from '@/lib/integrations/dataforseo/snapshots'

// DataForSEO weekly refresh — Mondays 04:00 UTC (after BrightLocal at 02:00).
// Pulls backlink summary, MTD new/lost detail rows, organic + local ranks for
// every active high-priority tracked keyword, and map grid ranks for every
// configured grid point. AI visibility runs in monthly-finalize, not weekly,
// because LLM Mentions calls are 5x more expensive than SERP calls.
//
// Hard-stops on first failure for a given client (rather than partial state
// across endpoints) — sync_log captures the boundary.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const hasApiKey = !!process.env.DATAFORSEO_API_KEY
  const hasLoginPair = !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD
  if (!hasApiKey && !hasLoginPair) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'DataForSEO credentials not configured. Set DATAFORSEO_API_KEY (preferred) or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.',
      },
      { status: 503 }
    )
  }

  const supa = createAdminClient()
  const start = Date.now()
  const monthKey = todayMonthKey()
  const { monthStart, nextMonthStart } = monthBounds()
  const errors: Array<{ client: string; stage: string; message: string }> = []
  const stats = {
    clients_processed: 0,
    backlink_snapshots: 0,
    backlink_new_rows: 0,
    backlink_lost_rows: 0,
    organic_ranks: 0,
    local_ranks: 0,
    map_grid_points: 0,
    gmb_locations: 0,
    gmb_updates: 0,
  }

  // Active, non-demo clients with a primary domain set.
  const { data: clients, error: clientsError } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain, is_demo_only, status')
    .eq('status', 'active')
    .eq('is_demo_only', false)
    .not('primary_domain', 'is', null)

  if (clientsError) {
    return NextResponse.json({ ok: false, error: clientsError.message }, { status: 500 })
  }

  for (const client of clients ?? []) {
    if (!client.primary_domain) continue
    stats.clients_processed += 1
    const clientStart = Date.now()
    let clientErrored = false

    try {
      // -------- Backlinks: summary + MTD counts --------
      const [summary, mtdCounts] = await Promise.all([
        getBacklinkSummary(client.primary_domain, { client_id: client.id }),
        getCurrentMonthNewLostCounts(client.primary_domain, { client_id: client.id }),
      ])
      await saveBacklinkSummarySnapshot(supa, {
        clientId: client.id,
        summary,
        mtdCounts,
      })
      stats.backlink_snapshots += 1

      // -------- Backlinks: new + lost detail rows --------
      const [newRows, lostRows] = await Promise.all([
        getNewBacklinkRowsForMonth(client.primary_domain, monthStart, nextMonthStart, 1000, {
          client_id: client.id,
        }),
        getLostBacklinkRowsForMonth(client.primary_domain, monthStart, nextMonthStart, 1000, {
          client_id: client.id,
        }),
      ])
      const newItems = ((newRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
      const lostItems = ((lostRows as { items?: Array<Record<string, unknown>> } | null)?.items ?? [])
      await saveBacklinkRows(supa, { clientId: client.id, monthKey, status: 'new', items: newItems })
      await saveBacklinkRows(supa, { clientId: client.id, monthKey, status: 'lost', items: lostItems })
      stats.backlink_new_rows += newItems.length
      stats.backlink_lost_rows += lostItems.length
    } catch (e) {
      clientErrored = true
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ client: client.firm_name, stage: 'backlinks', message })
      await supa.from('sync_log').insert({
        source: 'cron:dataforseo-weekly',
        client_id: client.id,
        status: 'error',
        error_message: `backlinks: ${message}`,
      })
    }

    // -------- SERP: organic + local ranks for high-priority keywords --------
    if (!clientErrored) {
      const { data: tracked } = await supa
        .from('dfs_tracked_keywords')
        .select('id, client_id, client_location_id, keyword, search_type, device, location_name, location_code, language_code, priority')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .in('priority', ['high', 'medium']) // weekly = high+medium; low runs monthly only
        .in('search_type', ['organic', 'local_pack'])

      for (const kw of tracked ?? []) {
        try {
          if (kw.search_type === 'organic') {
            const result = await getGoogleOrganicRank(
              {
                keyword: kw.keyword,
                clientDomain: client.primary_domain,
                locationCode: kw.location_code ?? undefined,
                locationName: kw.location_name ?? undefined,
                languageCode: kw.language_code ?? 'en',
                device: (kw.device as 'desktop' | 'mobile') ?? 'desktop',
              },
              { client_id: client.id }
            )
            await saveKeywordRankSnapshot(supa, {
              trackedKeywordId: kw.id,
              clientId: client.id,
              keyword: kw.keyword,
              searchType: 'organic',
              device: kw.device,
              locationName: kw.location_name,
              result,
            })
            stats.organic_ranks += 1
          } else if (kw.search_type === 'local_pack') {
            const result = await getGoogleLocalFinderRank(
              {
                keyword: kw.keyword,
                clientDomain: client.primary_domain,
                locationCode: kw.location_code ?? undefined,
                locationName: kw.location_name ?? undefined,
                languageCode: kw.language_code ?? 'en',
                device: (kw.device as 'desktop' | 'mobile') ?? 'desktop',
              },
              { client_id: client.id }
            )
            // Re-use the keyword snapshot table; matching rank/title shape.
            await saveKeywordRankSnapshot(supa, {
              trackedKeywordId: kw.id,
              clientId: client.id,
              keyword: kw.keyword,
              searchType: 'local_pack',
              device: kw.device,
              locationName: kw.location_name,
              result: {
                raw: result.raw,
                client_rank_group: result.client_rank_group,
                client_rank_absolute: result.client_rank_absolute,
                client_url: null,
                client_title: null,
                client_description: null,
                is_client_ranking: result.client_found,
                ranking_domain: null,
                serp_features: null,
                top_competitors: result.top_results.map((r) => ({
                  rank_group: r.rank_group,
                  rank_absolute: r.rank_absolute,
                  domain: null,
                  url: r.url,
                  title: r.title,
                })),
              },
            })
            stats.local_ranks += 1
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown'
          errors.push({ client: client.firm_name, stage: `keyword:${kw.keyword}`, message })
        }
      }

      // -------- Map grid: high-priority keywords × every grid point --------
      const { data: gridPoints } = await supa
        .from('dfs_map_grid_points')
        .select('id, client_location_id, lat, lng')

      const { data: gridKeywords } = await supa
        .from('dfs_tracked_keywords')
        .select('id, keyword, client_location_id, language_code')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .eq('priority', 'high')
        .eq('search_type', 'maps')

      for (const point of gridPoints ?? []) {
        const matchingKws = (gridKeywords ?? []).filter(
          (k) => k.client_location_id === point.client_location_id
        )
        for (const kw of matchingKws) {
          try {
            const result = await getGoogleMapsRankAtPoint(
              {
                keyword: kw.keyword,
                lat: Number(point.lat),
                lng: Number(point.lng),
                clientDomain: client.primary_domain,
                languageCode: kw.language_code ?? 'en',
              },
              { client_id: client.id }
            )
            await saveMapGridRankSnapshot(supa, {
              mapGridPointId: point.id,
              trackedKeywordId: kw.id,
              clientId: client.id,
              keyword: kw.keyword,
              lat: Number(point.lat),
              lng: Number(point.lng),
              result,
            })
            stats.map_grid_points += 1
          } catch (e) {
            const message = e instanceof Error ? e.message : 'unknown'
            errors.push({ client: client.firm_name, stage: `mapgrid:${kw.keyword}`, message })
          }
        }
      }

      // -------- GBP listing info + recent updates per location --------
      const { data: locations } = await supa
        .from('client_locations')
        .select('id, label, city, state, lat, lng, gbp_place_id')
        .eq('client_id', client.id)

      for (const loc of locations ?? []) {
        // Lookup args: place_id wins; otherwise lat/lng (5km radius). The
        // search endpoint requires a keyword either way, so we use the firm
        // name. Locations missing both gbp_place_id and lat/lng can't be
        // looked up — we record an error and continue.
        if (!loc.gbp_place_id && (loc.lat == null || loc.lng == null)) {
          errors.push({
            client: client.firm_name,
            stage: `gmb:${loc.label}`,
            message: 'No gbp_place_id and no lat/lng on client_locations',
          })
          continue
        }
        const lookupArgs = loc.gbp_place_id
          ? { placeId: loc.gbp_place_id, keyword: client.firm_name }
          : {
              keyword: client.firm_name,
              lat: Number(loc.lat),
              lng: Number(loc.lng),
            }
        try {
          const [info, updates] = await Promise.all([
            getGmbInfo(lookupArgs, { client_id: client.id }),
            getGmbUpdates(lookupArgs, { client_id: client.id }),
          ])
          if (info) {
            await saveGmbInfoSnapshot(supa, {
              clientId: client.id,
              locationId: loc.id,
              info,
              updatesCount: updates.length,
            })
            stats.gmb_locations += 1
          }
          if (updates.length > 0) {
            const { upserted } = await saveGmbUpdates(supa, {
              clientId: client.id,
              updates,
              externalIdFn: gmbUpdateExternalId,
            })
            stats.gmb_updates += upserted
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown'
          errors.push({ client: client.firm_name, stage: `gmb:${loc.label}`, message })
        }
      }

      await supa.from('sync_log').insert({
        source: 'cron:dataforseo-weekly',
        client_id: client.id,
        status: errors.some((e) => e.client === client.firm_name) ? 'partial' : 'ok',
        row_count: stats.backlink_new_rows + stats.backlink_lost_rows + stats.organic_ranks + stats.local_ranks + stats.map_grid_points + stats.gmb_locations + stats.gmb_updates,
        duration_ms: Date.now() - clientStart,
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ DataForSEO weekly cron — ${errors.length} error(s) across ${stats.clients_processed} client(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    stats,
    errors: errors.slice(0, 20), // cap response size
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
