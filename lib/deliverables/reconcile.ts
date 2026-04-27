import type { SupabaseClient } from '@supabase/supabase-js'

// Reconciliation: walk a client's active deliverables that auto-track from a
// given source, count matching rows in raw_* / normalized tables within the
// deliverable's period window, and update actual_count + status.
//
// Idempotent — safe to call multiple times. Only flips status to 'done' when
// actual_count >= target_count and the deliverable wasn't already done.

type Source = 'wp_post' | 'gbp_post' | 'social_post'

type DeliverableRow = {
  id: string
  template_id: string | null
  status: string
  actual_count: number | null
  period_start: string
  period_end: string
  template: {
    code: string
    target_count: number | null
    tracking_source: string
    matcher_config: Record<string, unknown>
  } | null
}

type CredentialRow = {
  wp_language_method: string | null
  wp_language_en_value: string | null
  wp_language_es_value: string | null
}

export async function reconcileDeliverables(
  supa: SupabaseClient,
  source: Source,
  clientId: string
): Promise<{ updated: number; flipped_done: number }> {
  let updated = 0
  let flipped_done = 0

  // Fetch active package deliverables for this client with this tracking source
  const { data: rows } = await supa
    .from('deliverables')
    .select(`
      id, template_id, status, actual_count, period_start, period_end,
      template:package_deliverables!inner(code, target_count, tracking_source, matcher_config),
      subscription:subscriptions!inner(client_id)
    `)
    .eq('subscription.client_id', clientId)
    .eq('template.tracking_source', source)
    .neq('status', 'done')
    .returns<(DeliverableRow & { subscription: { client_id: string } })[]>()

  if (!rows || rows.length === 0) {
    return { updated: 0, flipped_done: 0 }
  }

  // Pre-fetch credentials for resolve_from='client_credentials' cases
  const { data: creds } = await supa
    .from('client_credentials')
    .select('wp_language_method, wp_language_en_value, wp_language_es_value')
    .eq('client_id', clientId)
    .maybeSingle()
    .returns<CredentialRow | null>()

  for (const row of rows) {
    if (!row.template) continue
    const matcher = row.template.matcher_config ?? {}
    const target = row.template.target_count ?? 0

    let count = 0
    if (source === 'wp_post') {
      count = await countWpPosts(supa, clientId, row.period_start, row.period_end, matcher, creds)
    } else if (source === 'gbp_post') {
      count = await countGbpPosts(supa, clientId, row.period_start, row.period_end, matcher)
    } else if (source === 'social_post') {
      count = await countSocialPosts(supa, clientId, row.period_start, row.period_end, matcher)
    }

    const willComplete = target > 0 && count >= target && row.status !== 'done'
    const updates: Record<string, unknown> = {
      actual_count: count,
      updated_at: new Date().toISOString(),
    }
    if (willComplete) {
      updates.status = 'done'
      updates.completed_at = new Date().toISOString()
    }

    if ((row.actual_count ?? 0) !== count || willComplete) {
      const { error } = await supa.from('deliverables').update(updates).eq('id', row.id)
      if (!error) {
        updated++
        if (willComplete) flipped_done++
        await supa.from('activity_log').insert({
          entity_type: 'deliverable',
          entity_id: row.id,
          action: willComplete ? 'auto_completed' : 'auto_count_updated',
          after: { actual_count: count, target_count: target, source },
        })
      }
    }
  }

  return { updated, flipped_done }
}

async function countWpPosts(
  supa: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  matcher: Record<string, unknown>,
  creds: CredentialRow | null
): Promise<number> {
  const postType = (matcher.post_type as string) ?? 'post'
  const taxonomy = matcher.taxonomy as string | undefined  // 'category' | 'post_tag'
  const termSlug = matcher.term_slug as string | undefined
  const language = matcher.language as 'en' | 'es' | undefined
  const resolveFrom = matcher.resolve_from as string | undefined

  // Build a base query against raw_wordpress
  let query = supa
    .from('raw_wordpress')
    .select('post_id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('post_type', postType)
    .gte('modified_at', periodStart)
    .lte('modified_at', periodEnd + 'T23:59:59')

  // Static category/tag filter
  if (taxonomy === 'category' && termSlug) {
    query = query.contains('categories', [termSlug])
  } else if (taxonomy === 'post_tag' && termSlug) {
    query = query.contains('tags', [termSlug])
  }

  // Per-client language detection (BLOG_EN / BLOG_ES)
  if (language && resolveFrom === 'client_credentials' && creds) {
    const method = creds.wp_language_method
    const value = language === 'en' ? creds.wp_language_en_value : creds.wp_language_es_value
    if (!value || method === 'none' || !method) {
      // No detection method set yet → can't auto-track, return 0 so admin
      // is reminded to configure it
      return 0
    }
    if (method === 'category' && value) query = query.contains('categories', [value])
    else if (method === 'tag' && value) query = query.contains('tags', [value])
    else if (method === 'polylang' && value) query = query.eq('language', value)
    // 'wpml' / 'path' are deferred — Phase 6+ extension
  }

  const { count } = await query
  return count ?? 0
}

async function countGbpPosts(
  supa: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  matcher: Record<string, unknown>
): Promise<number> {
  const sourceField = (matcher.source_field as string) ?? 'posts_30d'
  const { data } = await supa
    .from('raw_gmb')
    .select('*')
    .eq('client_id', clientId)
    .gte('captured_at', periodStart)
    .lte('captured_at', periodEnd + 'T23:59:59')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return 0
  const row = data as unknown as Record<string, unknown>
  const v = row[sourceField]
  return typeof v === 'number' ? v : 0
}

async function countSocialPosts(
  supa: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  matcher: Record<string, unknown>
): Promise<number> {
  const channels = (matcher.channels as string[]) ?? []
  if (channels.length === 0) return 0
  const { data } = await supa
    .from('raw_metricool')
    .select('posts_count')
    .eq('client_id', clientId)
    .in('channel', channels)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)

  return (data ?? []).reduce((sum, r) => sum + (Number(r.posts_count) || 0), 0)
}
