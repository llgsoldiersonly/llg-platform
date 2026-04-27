import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchPsi } from '@/lib/integrations/psi'

// Weekly Mon 03:30 UTC. Hits PSI for each client's homepage on both
// mobile + desktop. ~12 calls / week for 6 clients (24 if we add inner
// pages later — well under PSI's 25k/day quota).
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.PSI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'PSI_API_KEY not configured' }, { status: 503 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  let totalProcessed = 0
  const errors: Array<{ client: string; message: string }> = []

  const { data: clients } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .neq('status', 'churned')
    .eq('is_demo_only', false)
    .not('primary_domain', 'is', null)

  const today = new Date().toISOString().slice(0, 10)

  for (const client of clients ?? []) {
    if (!client.primary_domain) continue
    const url = `https://${client.primary_domain}/`

    for (const strategy of ['mobile', 'desktop'] as const) {
      try {
        const psi = await fetchPsi({
          apiKey: process.env.PSI_API_KEY!,
          url,
          strategy,
        })

        await supa.from('raw_lighthouse').insert({
          client_id: client.id,
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
          captured_at: new Date().toISOString(),
        })

        await supa.from('site_health').upsert(
          {
            client_id: client.id,
            url,
            strategy,
            performance: psi.performance,
            seo: psi.seo,
            accessibility: psi.accessibility,
            best_practices: psi.best_practices,
            lcp_ms: psi.lcp_ms != null ? Math.round(psi.lcp_ms) : null,
            fid_ms: psi.fid_ms != null ? Math.round(psi.fid_ms) : null,
            cls: psi.cls,
            captured_on: today,
          },
          { onConflict: 'client_id,url,strategy,captured_on' }
        )

        totalProcessed++
        await supa.from('sync_log').insert({
          source: 'cron:lighthouse',
          client_id: client.id,
          status: 'ok',
          row_count: 1,
          duration_ms: Date.now() - start,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown'
        errors.push({ client: `${client.firm_name} (${strategy})`, message })
        await supa.from('sync_log').insert({
          source: 'cron:lighthouse',
          client_id: client.id,
          status: 'error',
          error_message: message,
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    pages_synced: totalProcessed,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
