import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchWpPosts, extractTerms } from '@/lib/integrations/wordpress'
import { reconcileDeliverables } from '@/lib/deliverables/reconcile'
import { postToGlip } from '@/lib/integrations/ringcentral'

// Daily 02:00 UTC. Pulls WordPress posts modified in the last 14 days
// per client, upserts to raw_wordpress + posts, then reconciles
// auto-tracked deliverables.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  let totalProcessed = 0
  const errors: Array<{ client: string; message: string }> = []

  // Get all non-demo, non-churned clients with WP credentials configured
  const { data: clients } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .neq('status', 'churned')
    .eq('is_demo_only', false)

  const targets = clients ?? []
  const lookback = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  for (const client of targets) {
    const { data: creds } = await supa
      .from('client_credentials')
      .select('wp_username, wp_app_password')
      .eq('client_id', client.id)
      .maybeSingle()

    if (!creds?.wp_username || !creds?.wp_app_password) {
      // Not configured yet — skip silently
      await supa.from('sync_log').insert({
        source: 'cron:wordpress',
        client_id: client.id,
        status: 'skipped',
        error_message: 'No WP credentials',
      })
      continue
    }

    if (!client.primary_domain) {
      await supa.from('sync_log').insert({
        source: 'cron:wordpress',
        client_id: client.id,
        status: 'skipped',
        error_message: 'No primary_domain set',
      })
      continue
    }

    // WP credentials are per-client, so auto-sync runs against the primary
    // site only; we stamp its site_id to keep posts/raw_wordpress consistent
    // with the per-site unique keys. (Per-site WP auto-sync needs per-site
    // credentials — a separate change; secondary-site blogs are logged via
    // staff Submissions today.)
    const { data: primarySiteRow } = await supa
      .from('client_sites')
      .select('id')
      .eq('client_id', client.id)
      .eq('is_primary', true)
      .maybeSingle()
    const siteId = primarySiteRow?.id ?? null

    try {
      const posts = await fetchWpPosts({
        domain: client.primary_domain,
        username: creds.wp_username,
        appPassword: creds.wp_app_password,
        modifiedAfter: lookback,
      })

      if (posts.length === 0) {
        await supa.from('sync_log').insert({
          source: 'cron:wordpress',
          client_id: client.id,
          status: 'ok',
          row_count: 0,
        })
        continue
      }

      // Upsert raw_wordpress
      const rawRows = posts.map((p) => {
        const terms = extractTerms(p)
        return {
          client_id: client.id,
          site_id: siteId,
          post_id: p.id,
          slug: p.slug,
          title: p.title?.rendered ?? '',
          content_html: p.content?.rendered ?? '',
          post_type: p.type === 'page' ? 'page' : 'post',
          post_status: p.status,
          categories: terms.categories,
          tags: terms.tags,
          language: p.lang ?? null,
          url: p.link,
          modified_at: p.modified_gmt ? new Date(p.modified_gmt + 'Z').toISOString() : null,
          fetched_at: new Date().toISOString(),
          raw_json: p,
        }
      })
      await supa.from('raw_wordpress').upsert(rawRows, {
        onConflict: 'client_id,site_id,post_id,post_type',
      })

      // Upsert normalized posts
      const normRows = posts.map((p) => {
        const terms = extractTerms(p)
        return {
          client_id: client.id,
          site_id: siteId,
          source_type: p.type === 'page' ? 'wp_page' : 'wp_post',
          external_id: String(p.id),
          slug: p.slug,
          title: p.title?.rendered ?? '',
          excerpt: p.excerpt?.rendered ?? null,
          categories: terms.categories,
          tags: terms.tags,
          language: p.lang ?? null,
          published_at: p.date_gmt ? new Date(p.date_gmt + 'Z').toISOString() : null,
          modified_at: p.modified_gmt ? new Date(p.modified_gmt + 'Z').toISOString() : null,
          url: p.link,
        }
      })
      await supa.from('posts').upsert(normRows, {
        onConflict: 'client_id,site_id,source_type,external_id',
      })

      // Reconcile WP-driven deliverables for this client
      await reconcileDeliverables(supa, 'wp_post', client.id)

      totalProcessed += posts.length
      await supa.from('sync_log').insert({
        source: 'cron:wordpress',
        client_id: client.id,
        status: 'ok',
        row_count: posts.length,
        duration_ms: Date.now() - start,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      errors.push({ client: client.firm_name, message })
      await supa.from('sync_log').insert({
        source: 'cron:wordpress',
        client_id: client.id,
        status: 'error',
        error_message: message,
        error_stack: e instanceof Error ? e.stack : null,
      })
    }
  }

  // Notify alerts on any error
  if (errors.length > 0 && process.env.RC_WEBHOOK_ALERTS) {
    try {
      await postToGlip(process.env.RC_WEBHOOK_ALERTS, {
        text: `⚠️ WordPress cron had ${errors.length} error(s): ${errors.map((e) => `${e.client}: ${e.message}`).join('; ')}`,
        activity: 'Cron error',
      })
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    ok: true,
    clients_processed: targets.length,
    posts_synced: totalProcessed,
    errors: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
