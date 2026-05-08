import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMetricoolStats } from '@/lib/integrations/metricool'
import { reconcileDeliverables } from '@/lib/deliverables/reconcile'
import { postToGlip } from '@/lib/integrations/ringcentral'

// Daily 02:30 UTC. Pulls per-channel social stats for the last 7 days
// per client. Upserts to raw_metricool + social_stats. Reconciles
// SOCIAL_DAILY deliverables.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.METRICOOL_API_KEY) {
    return NextResponse.json({ ok: false, error: 'METRICOOL_API_KEY not configured' }, { status: 503 })
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
  const endDate = new Date()
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  for (const client of targets) {
    const { data: creds } = await supa
      .from('client_credentials')
      .select('metricool_user_id, metricool_blog_id')
      .eq('client_id', client.id)
      .maybeSingle()

    if (!creds?.metricool_user_id || !creds?.metricool_blog_id) {
      await supa.from('sync_log').insert({
        source: 'cron:metricool',
        client_id: client.id,
        status: 'skipped',
        error_message: 'No Metricool user_id/blog_id',
      })
      continue
    }

    try {
      const stats = await fetchMetricoolStats({
        apiKey: process.env.METRICOOL_API_KEY!,
        userId: creds.metricool_user_id,
        blogId: creds.metricool_blog_id,
        startDate,
        endDate,
      })

      if (stats.length === 0) {
        await supa.from('sync_log').insert({
          source: 'cron:metricool',
          client_id: client.id,
          status: 'ok',
          row_count: 0,
        })
        continue
      }

      const rawRows = stats.map((s) => ({
        client_id: client.id,
        channel: s.channel,
        period_start: startDate.toISOString().slice(0, 10),
        period_end: endDate.toISOString().slice(0, 10),
        followers: s.followers ?? null,
        reach: s.reach ?? null,
        impressions: s.impressions ?? null,
        posts_count: s.posts_count ?? null,
        ad_spend_cents: s.ad_spend_cents ?? null,
        raw_json: s.raw,
        fetched_at: new Date().toISOString(),
      }))
      await supa.from('raw_metricool').upsert(rawRows, {
        onConflict: 'client_id,channel,period_start',
      })

      const normRows = stats.map((s) => ({
        client_id: client.id,
        channel: s.channel,
        period_start: startDate.toISOString().slice(0, 10),
        period_end: endDate.toISOString().slice(0, 10),
        followers: s.followers ?? null,
        reach: s.reach ?? null,
        impressions: s.impressions ?? null,
        posts_count: s.posts_count ?? null,
        ad_spend_cents: s.ad_spend_cents ?? null,
      }))
      await supa.from('social_stats').upsert(normRows, {
        onConflict: 'client_id,channel,period_start',
      })

      // Reconcile SOCIAL_DAILY-type deliverables
      await reconcileDeliverables(supa, 'social_post', client.id)

      totalProcessed += stats.length
      await supa.from('sync_log').insert({
        source: 'cron:metricool',
        client_id: client.id,
        status: 'ok',
        row_count: stats.length,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ client: client.firm_name, message })
      await supa.from('sync_log').insert({
        source: 'cron:metricool',
        client_id: client.id,
        status: 'error',
        error_message: message,
      })
    }
  }

  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ Metricool cron had ${errors.length} error(s)`,
        activity: 'Cron error',
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    clients_processed: targets.length,
    channels_synced: totalProcessed,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
