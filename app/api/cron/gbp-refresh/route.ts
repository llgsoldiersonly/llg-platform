import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToGlip } from '@/lib/integrations/ringcentral'
import { getGmbInfo, getGmbUpdates, gmbUpdateExternalId } from '@/lib/integrations/dataforseo/gmb'
import { saveGmbInfoSnapshot, saveGmbUpdates } from '@/lib/integrations/dataforseo/snapshots'

export const maxDuration = 300

// Dedicated GBP refresh cron — split off from the main DFS weekly refresh
// because GBP updates use a task-based endpoint that needs ~20-30s polling
// per location. Bundled with the other data sources we were blowing past
// Vercel's 300s cap. This route does ONLY GBP info + updates per location,
// which fits comfortably within the budget.
//
// Schedule: Mondays 05:00 UTC (1 hour after the main DFS weekly refresh).
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.DATAFORSEO_API_KEY && !process.env.DATAFORSEO_LOGIN) {
    return NextResponse.json(
      { ok: false, error: 'DataForSEO credentials not configured.' },
      { status: 503 }
    )
  }

  const supa = createAdminClient()
  const start = Date.now()
  const errors: Array<{ client: string; stage: string; message: string }> = []
  const stats = {
    clients_processed: 0,
    locations_processed: 0,
    locations_with_info: 0,
    updates_saved: 0,
  }

  // Pull active, non-demo firms with at least one location that has lat/lng.
  const { data: clients, error: clientsErr } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .eq('status', 'active')
    .eq('is_demo_only', false)

  if (clientsErr) {
    return NextResponse.json({ ok: false, error: clientsErr.message }, { status: 500 })
  }

  // Build the per-location jobs upfront so we can fan out in parallel.
  type GbpJob = {
    clientId: string
    clientFirmName: string
    clientPrimaryDomain: string | null
    locationId: string
    locationLabel: string
    placeId: string | null
    lat: number
    lng: number
  }
  const jobs: GbpJob[] = []

  for (const client of clients ?? []) {
    stats.clients_processed += 1
    const { data: locations } = await supa
      .from('client_locations')
      .select('id, label, city, state, lat, lng, gbp_place_id')
      .eq('client_id', client.id)

    for (const loc of locations ?? []) {
      if (loc.lat == null || loc.lng == null) {
        errors.push({
          client: client.firm_name,
          stage: `gbp:${loc.label}`,
          message: 'No lat/lng on client_locations — skipped',
        })
        continue
      }
      jobs.push({
        clientId: client.id,
        clientFirmName: client.firm_name,
        clientPrimaryDomain: client.primary_domain,
        locationId: loc.id,
        locationLabel: loc.label,
        placeId: loc.gbp_place_id,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
      })
    }
  }

  // Fan out: info + updates concurrently per location. Total time bounded
  // by the slowest single location (~30s for updates polling).
  const results = await Promise.all(
    jobs.map(async (j) => {
      const [infoResult, updatesResult] = await Promise.allSettled([
        getGmbInfo(
          {
            firmName: j.clientFirmName,
            placeId: j.placeId,
            primaryDomain: j.clientPrimaryDomain,
            lat: j.lat,
            lng: j.lng,
          },
          { client_id: j.clientId }
        ),
        getGmbUpdates(
          {
            firmName: j.clientFirmName,
            placeId: j.placeId,
            primaryDomain: j.clientPrimaryDomain,
            lat: j.lat,
            lng: j.lng,
          },
          { client_id: j.clientId }
        ),
      ])
      return { job: j, infoResult, updatesResult }
    })
  )

  // Persist sequentially — Supabase inserts are fast, and serial keeps the
  // stats counters honest.
  for (const { job, infoResult, updatesResult } of results) {
    stats.locations_processed += 1

    if (infoResult.status === 'rejected') {
      errors.push({
        client: job.clientFirmName,
        stage: `gbp:${job.locationLabel}`,
        message: infoResult.reason instanceof Error ? infoResult.reason.message : 'unknown',
      })
      continue
    }
    if (!infoResult.value) {
      errors.push({
        client: job.clientFirmName,
        stage: `gbp:${job.locationLabel}`,
        message: job.placeId
          ? `place_id ${job.placeId.slice(0, 20)}... not in top Maps SERP — try broader zoom`
          : 'Maps SERP found no match by name or domain',
      })
      continue
    }

    const updates = updatesResult.status === 'fulfilled' ? updatesResult.value : []
    try {
      await saveGmbInfoSnapshot(supa, {
        clientId: job.clientId,
        locationId: job.locationId,
        info: infoResult.value,
        updatesCount: updates.length,
      })
      if (updates.length > 0) {
        await saveGmbUpdates(supa, {
          clientId: job.clientId,
          updates,
          externalIdFn: gmbUpdateExternalId,
        })
        stats.updates_saved += updates.length
      }
      stats.locations_with_info += 1
    } catch (e) {
      errors.push({
        client: job.clientFirmName,
        stage: `gbp:${job.locationLabel}`,
        message: e instanceof Error ? e.message : 'snapshot write failed',
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ GBP refresh cron — ${errors.length} error(s) across ${stats.clients_processed} client(s)`,
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

export const GET = POST
