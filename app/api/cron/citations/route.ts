import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCitationTrackerResults } from '@/lib/integrations/brightlocal'

// Monthly 1st of month, 03:00 UTC. Reads the latest Citation Tracker
// report results per location and snapshots into raw_citations + citations.
//
// Note: this version READS existing reports. The expensive "submit a new
// report and poll" flow is deferred — for v1 we trust that an admin (or
// scripts/setup-brightlocal.ts in Phase 8) creates one report per location
// and BL refreshes them on its own cadence.
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
  let totalProcessed = 0
  const errors: Array<{ location: string; message: string }> = []

  const { data: locations } = await supa
    .from('client_locations')
    .select('id, client_id, label, brightlocal_citation_report_id')
    .not('brightlocal_citation_report_id', 'is', null)

  const today = new Date().toISOString().slice(0, 10)

  for (const loc of locations ?? []) {
    if (!loc.brightlocal_citation_report_id) continue

    try {
      const result = await getCitationTrackerResults(
        process.env.BRIGHTLOCAL_API_KEY!,
        loc.brightlocal_citation_report_id
      )
      if (!result) {
        await supa.from('sync_log').insert({
          source: 'cron:citations',
          client_id: loc.client_id,
          status: 'skipped',
          error_message: 'Empty citation result',
        })
        continue
      }

      await supa.from('raw_citations').insert({
        client_id: loc.client_id,
        health_score: result.health_score,
        correct_count: result.correct_count,
        incorrect_count: result.incorrect_count,
        missing_count: result.missing_count,
        directories: result.directories,
        ai_fixes: result.ai_fixes,
        captured_at: new Date().toISOString(),
      })

      await supa.from('citations').upsert(
        {
          client_id: loc.client_id,
          health_score: result.health_score,
          correct_count: result.correct_count,
          incorrect_count: result.incorrect_count,
          missing_count: result.missing_count,
          captured_on: today,
        },
        { onConflict: 'client_id,captured_on' }
      )

      totalProcessed++
      await supa.from('sync_log').insert({
        source: 'cron:citations',
        client_id: loc.client_id,
        status: 'ok',
        row_count: 1,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ location: loc.label, message })
      await supa.from('sync_log').insert({
        source: 'cron:citations',
        client_id: loc.client_id,
        status: 'error',
        error_message: message,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    locations_processed: (locations ?? []).length,
    citations_synced: totalProcessed,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
