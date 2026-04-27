import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCallRailCalls } from '@/lib/integrations/callrail'
import { postToGlip } from '@/lib/integrations/ringcentral'

// Daily 02:20 UTC. Pulls calls from last 2 days per client to catch
// late-syncing calls. Upserts to raw_callrail + calls.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.CALLRAIL_API_TOKEN) {
    return NextResponse.json({ ok: false, error: 'CALLRAIL_API_TOKEN not configured' }, { status: 503 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  let totalProcessed = 0
  const errors: Array<{ client: string; message: string }> = []

  const { data: clients } = await supa
    .from('clients')
    .select('id, firm_name')
    .neq('status', 'churned')
    .eq('is_demo_only', false)

  const targets = clients ?? []
  const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const endDate = new Date()

  for (const client of targets) {
    const { data: creds } = await supa
      .from('client_credentials')
      .select('callrail_account_id, callrail_company_id')
      .eq('client_id', client.id)
      .maybeSingle()

    if (!creds?.callrail_account_id) {
      await supa.from('sync_log').insert({
        source: 'cron:callrail',
        client_id: client.id,
        status: 'skipped',
        error_message: 'No CallRail account_id',
      })
      continue
    }

    try {
      const calls = await fetchCallRailCalls({
        apiToken: process.env.CALLRAIL_API_TOKEN!,
        accountId: creds.callrail_account_id,
        companyId: creds.callrail_company_id ?? undefined,
        startDate,
        endDate,
      })

      if (calls.length === 0) {
        await supa.from('sync_log').insert({
          source: 'cron:callrail',
          client_id: client.id,
          status: 'ok',
          row_count: 0,
        })
        continue
      }

      const rawRows = calls.map((c) => ({
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
        raw_json: c,
        fetched_at: new Date().toISOString(),
      }))
      await supa.from('raw_callrail').upsert(rawRows, { onConflict: 'client_id,call_id' })

      const normRows = calls.map((c) => ({
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
      }))
      await supa.from('calls').upsert(normRows, { onConflict: 'client_id,external_id' })

      totalProcessed += calls.length
      await supa.from('sync_log').insert({
        source: 'cron:callrail',
        client_id: client.id,
        status: 'ok',
        row_count: calls.length,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ client: client.firm_name, message })
      await supa.from('sync_log').insert({
        source: 'cron:callrail',
        client_id: client.id,
        status: 'error',
        error_message: message,
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ CallRail cron had ${errors.length} error(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    clients_processed: targets.length,
    calls_synced: totalProcessed,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
