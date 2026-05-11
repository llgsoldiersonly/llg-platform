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
import { getGmbInfo, submitGmbInfoTask, fetchGmbInfoTask } from '@/lib/integrations/dataforseo/gmb'
import {
  saveBacklinkSummarySnapshot,
  saveBacklinkRows,
  saveKeywordRankSnapshot,
  saveMapGridRankSnapshot,
  saveGmbInfoSnapshot,
  monthBounds,
  todayMonthKey,
} from '@/lib/integrations/dataforseo/snapshots'

// GBP task-based lookups (submit → wait → fetch) add ~12s of in-flight time.
// Bump maxDuration so the cron has runway for 5 active clients + GBP.
export const maxDuration = 300

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

  // Collected during the per-client loop, batch-processed after.
  type GbpJob = {
    clientId: string
    clientFirmName: string
    clientPrimaryDomain: string | null
    locationId: string
    locationLabel: string
    placeId: string | null
    lat: number | null
    lng: number | null
  }
  const gbpJobs: GbpJob[] = []

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
      // Scope grid points to THIS client's locations (table has no direct
      // client_id column; FK is via client_location_id).
      const { data: clientLocsForGrid } = await supa
        .from('client_locations')
        .select('id')
        .eq('client_id', client.id)
      const locationIds = (clientLocsForGrid ?? []).map((l) => l.id)

      const { data: gridPoints } = locationIds.length > 0
        ? await supa
            .from('dfs_map_grid_points')
            .select('id, client_location_id, lat, lng')
            .in('client_location_id', locationIds)
        : { data: [] as Array<{ id: string; client_location_id: string; lat: number | string; lng: number | string }> }

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

      // -------- GBP locations: collect for batch processing AFTER client loop --------
      // We collect (client, location) pairs and process all of them in
      // parallel after the per-client loop ends. Reason: the task-based
      // my_business_info endpoint needs a ~12s wait between submit and
      // fetch; doing that inside the per-client loop would be ~12s * N
      // locations of mostly sleeping. Batching = single wait for all.
      const { data: locations } = await supa
        .from('client_locations')
        .select('id, label, city, state, lat, lng, gbp_place_id')
        .eq('client_id', client.id)

      for (const loc of locations ?? []) {
        gbpJobs.push({
          clientId: client.id,
          clientFirmName: client.firm_name,
          clientPrimaryDomain: client.primary_domain,
          locationId: loc.id,
          locationLabel: loc.label,
          placeId: loc.gbp_place_id,
          lat: loc.lat != null ? Number(loc.lat) : null,
          lng: loc.lng != null ? Number(loc.lng) : null,
        })
      }

      await supa.from('sync_log').insert({
        source: 'cron:dataforseo-weekly',
        client_id: client.id,
        status: errors.some((e) => e.client === client.firm_name) ? 'partial' : 'ok',
        row_count: stats.backlink_new_rows + stats.backlink_lost_rows + stats.organic_ranks + stats.local_ranks + stats.map_grid_points,
        duration_ms: Date.now() - clientStart,
      })
    }
  }

  // ============================================================
  // GBP batch — task-based for jobs with place_id, coordinate fallback otherwise
  // ============================================================
  const placeIdJobs = gbpJobs.filter((j) => j.placeId)
  const fallbackJobs = gbpJobs.filter((j) => !j.placeId && j.lat != null && j.lng != null)
  const skippedJobs = gbpJobs.filter((j) => !j.placeId && (j.lat == null || j.lng == null))

  for (const j of skippedJobs) {
    errors.push({
      client: j.clientFirmName,
      stage: `gmb:${j.locationLabel}`,
      message: 'No gbp_place_id and no lat/lng — skipped',
    })
  }

  // Submit all task_post in parallel — task-based my_business_info path.
  const taskIds = await Promise.all(
    placeIdJobs.map((j) =>
      submitGmbInfoTask({ placeId: j.placeId! }, { client_id: j.clientId })
    )
  )

  // Wait for DataForSEO to process — priority=2 normally returns in ~5-10s.
  if (placeIdJobs.length > 0) {
    await new Promise((r) => setTimeout(r, 12000))
  }

  // Fetch all task_get in parallel.
  const taskResults = await Promise.all(
    taskIds.map((id, i) =>
      id ? fetchGmbInfoTask(id, { client_id: placeIdJobs[i].clientId }) : Promise.resolve(null)
    )
  )

  for (let i = 0; i < placeIdJobs.length; i++) {
    const j = placeIdJobs[i]
    const info = taskResults[i]
    if (!info) {
      errors.push({
        client: j.clientFirmName,
        stage: `gmb:${j.locationLabel}`,
        message: !taskIds[i]
          ? 'task_post failed'
          : 'task_get returned no items (still processing or place_id invalid)',
      })
      continue
    }
    try {
      await saveGmbInfoSnapshot(supa, {
        clientId: j.clientId,
        locationId: j.locationId,
        info,
        updatesCount: 0,
      })
      stats.gmb_locations += 1
    } catch (e) {
      errors.push({
        client: j.clientFirmName,
        stage: `gmb:${j.locationLabel}`,
        message: e instanceof Error ? e.message : 'snapshot write failed',
      })
    }
  }

  // Coordinate-fallback for locations without a place_id, in parallel.
  const fallbackResults = await Promise.all(
    fallbackJobs.map(async (j) => {
      try {
        const info = await getGmbInfo(
          {
            firmName: j.clientFirmName,
            primaryDomain: j.clientPrimaryDomain,
            lat: j.lat!,
            lng: j.lng!,
          },
          { client_id: j.clientId }
        )
        return { ok: true as const, info }
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' }
      }
    })
  )

  for (let i = 0; i < fallbackJobs.length; i++) {
    const j = fallbackJobs[i]
    const r = fallbackResults[i]
    if (!r.ok) {
      errors.push({ client: j.clientFirmName, stage: `gmb:${j.locationLabel}`, message: r.error })
      continue
    }
    if (!r.info) {
      errors.push({
        client: j.clientFirmName,
        stage: `gmb:${j.locationLabel}`,
        message: 'Maps SERP fallback found no match',
      })
      continue
    }
    try {
      await saveGmbInfoSnapshot(supa, {
        clientId: j.clientId,
        locationId: j.locationId,
        info: r.info,
        updatesCount: 0,
      })
      stats.gmb_locations += 1
    } catch (e) {
      errors.push({
        client: j.clientFirmName,
        stage: `gmb:${j.locationLabel}`,
        message: e instanceof Error ? e.message : 'snapshot write failed',
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
