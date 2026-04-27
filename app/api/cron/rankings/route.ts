import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRankTrackerResults } from '@/lib/integrations/brightlocal'
import { postToGlip } from '@/lib/integrations/ringcentral'

// Weekly Mon 02:00 UTC. Pulls latest BrightLocal Rank Tracker results
// per location's brightlocal_rank_tracker_campaign_id.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.BRIGHTLOCAL_API_KEY) {
    return NextResponse.json({ ok: false, error: 'BRIGHTLOCAL_API_KEY not configured' }, { status: 503 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  let totalKeywords = 0
  const errors: Array<{ location: string; message: string }> = []

  // Pull every active client_locations row that has a campaign id
  const { data: locations } = await supa
    .from('client_locations')
    .select(`
      id, client_id, label, city, state,
      brightlocal_rank_tracker_campaign_id
    `)
    .not('brightlocal_rank_tracker_campaign_id', 'is', null)

  const targets = locations ?? []
  const today = new Date().toISOString().slice(0, 10)

  for (const loc of targets) {
    if (!loc.brightlocal_rank_tracker_campaign_id) continue

    try {
      const results = await getRankTrackerResults(
        process.env.BRIGHTLOCAL_API_KEY!,
        loc.brightlocal_rank_tracker_campaign_id
      )

      if (results.length === 0) {
        await supa.from('sync_log').insert({
          source: 'cron:rankings',
          client_id: loc.client_id,
          status: 'ok',
          row_count: 0,
        })
        continue
      }

      const rawRows = results.map((r) => ({
        client_id: loc.client_id,
        location_id: loc.id,
        keyword: r.keyword,
        position_google: r.positions.google ?? null,
        position_google_mobile: r.positions.google_mobile ?? null,
        position_google_local_finder: r.positions.google_local_finder ?? null,
        position_bing: r.positions.bing ?? null,
        last_position_google: r.last_position_google ?? null,
        url: r.url ?? null,
        captured_at: new Date().toISOString(),
      }))
      await supa.from('raw_rankings').insert(rawRows)

      // Compute delta vs previous week for each keyword
      const normRows = await Promise.all(
        results.map(async (r) => {
          const { data: prev } = await supa
            .from('rankings_daily')
            .select('position')
            .eq('client_id', loc.client_id)
            .eq('location_id', loc.id)
            .eq('keyword', r.keyword)
            .order('captured_on', { ascending: false })
            .limit(1)
            .maybeSingle()
          const prevPos = prev?.position ?? null
          const newPos = r.positions.google ?? null
          return {
            client_id: loc.client_id,
            location_id: loc.id,
            keyword: r.keyword,
            position: newPos,
            position_mobile: r.positions.google_mobile ?? null,
            position_local_finder: r.positions.google_local_finder ?? null,
            position_bing: r.positions.bing ?? null,
            position_change: prevPos != null && newPos != null ? prevPos - newPos : null,
            url: r.url ?? null,
            captured_on: today,
          }
        })
      )
      await supa.from('rankings_daily').upsert(normRows, {
        onConflict: 'client_id,location_id,keyword,captured_on',
      })

      totalKeywords += results.length
      await supa.from('sync_log').insert({
        source: 'cron:rankings',
        client_id: loc.client_id,
        status: 'ok',
        row_count: results.length,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ location: `${loc.label} (${loc.city})`, message })
      await supa.from('sync_log').insert({
        source: 'cron:rankings',
        client_id: loc.client_id,
        status: 'error',
        error_message: message,
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ Rankings cron had ${errors.length} error(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    locations_processed: targets.length,
    keywords_synced: totalKeywords,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
