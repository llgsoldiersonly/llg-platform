import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Cron: daily 03:00 UTC. Auto-closes tickets stuck in 'waiting_on_client'
// for longer than platform_settings.auto_close_inactive_days (default 7).
// Sets close_reason='inactivity' so the client can reopen via the UI.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()

  const { data: settings } = await supa
    .from('platform_settings')
    .select('auto_close_inactive_days')
    .eq('id', 1)
    .maybeSingle()
  const days = settings?.auto_close_inactive_days ?? 7

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates } = await supa
    .from('tickets')
    .select('id')
    .eq('status', 'waiting_on_client')
    .lt('updated_at', cutoff)

  const ids = (candidates ?? []).map((t) => t.id)
  if (ids.length === 0) {
    await supa.from('sync_log').insert({
      source: 'cron:auto-close-inactive',
      status: 'ok',
      row_count: 0,
    })
    return NextResponse.json({ ok: true, closed: 0 })
  }

  const { error } = await supa
    .from('tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      close_reason: 'inactivity',
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (error) {
    await supa.from('sync_log').insert({
      source: 'cron:auto-close-inactive',
      status: 'error',
      error_message: error.message,
    })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await supa.from('sync_log').insert({
    source: 'cron:auto-close-inactive',
    status: 'ok',
    row_count: ids.length,
  })

  return NextResponse.json({ ok: true, closed: ids.length })
}

export const GET = POST
