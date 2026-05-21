import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchPsi } from '@/lib/integrations/psi'

// Cap Vercel's serverless duration. Each PSI audit is 20-30s; running
// in parallel below means total time ≈ slowest single audit, but we
// allow up to 60s headroom for cold starts + Supabase writes.
export const maxDuration = 60

// Weekly Mon 03:30 UTC. Hits PSI for each client's homepage on both
// mobile + desktop. ~12 calls / week for 6 clients (24 if we add inner
// pages later — well under PSI's 25k/day quota).
//
// All PSI calls run in parallel via Promise.allSettled so a single
// slow / failed audit doesn't block the rest. Sequential per-client
// looping in the previous version timed out at 300s on Vercel.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.PSI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'PSI_API_KEY not configured' }, { status: 503 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  const apiKey = process.env.PSI_API_KEY!

  const { data: clients } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .neq('status', 'churned')
    .eq('is_demo_only', false)
    .not('primary_domain', 'is', null)

  const today = new Date().toISOString().slice(0, 10)

  // Build flat list of (client, strategy) audit jobs.
  type Job = { client: { id: string; firm_name: string; primary_domain: string }; strategy: 'mobile' | 'desktop' }
  const jobs: Job[] = []
  for (const c of clients ?? []) {
    if (!c.primary_domain) continue
    jobs.push({ client: c as Job['client'], strategy: 'mobile' })
    jobs.push({ client: c as Job['client'], strategy: 'desktop' })
  }

  const results = await Promise.allSettled(
    jobs.map(async ({ client, strategy }) => {
      const url = `https://${client.primary_domain}/`
      const psi = await fetchPsi({ apiKey, url, strategy })

      const cruxFields = {
        crux_lcp_ms: psi.crux.lcp_ms,
        crux_inp_ms: psi.crux.inp_ms,
        crux_cls: psi.crux.cls,
        crux_fcp_ms: psi.crux.fcp_ms,
        crux_category: psi.crux.category,
      }

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
        ...cruxFields,
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
          ...cruxFields,
          captured_on: today,
        },
        { onConflict: 'client_id,url,strategy,captured_on' }
      )

      return { client_id: client.id, strategy }
    })
  )

  const succeeded: Array<{ client_id: string; strategy: string }> = []
  const errors: Array<{ client: string; strategy: string; message: string }> = []
  for (let i = 0; i < results.length; i++) {
    const job = jobs[i]
    const r = results[i]
    if (r.status === 'fulfilled') {
      succeeded.push(r.value)
    } else {
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason ?? 'unknown')
      errors.push({ client: job.client.firm_name, strategy: job.strategy, message })
    }
  }

  // Log per-client outcome (one sync_log row per audit). Deliberately
  // sequential because they're cheap inserts and the parallel writes
  // already happened up there.
  for (const s of succeeded) {
    await supa.from('sync_log').insert({
      source: 'cron:lighthouse',
      client_id: s.client_id,
      status: 'ok',
      row_count: 1,
      duration_ms: Date.now() - start,
    })
  }
  for (const e of errors) {
    const job = jobs.find((j) => j.client.firm_name === e.client && j.strategy === e.strategy)
    await supa.from('sync_log').insert({
      source: 'cron:lighthouse',
      client_id: job?.client.id,
      status: 'error',
      error_message: `${e.strategy}: ${e.message}`,
    })
  }

  return NextResponse.json({
    ok: true,
    pages_synced: succeeded.length,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
