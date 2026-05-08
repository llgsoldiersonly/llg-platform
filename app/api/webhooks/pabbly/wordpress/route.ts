import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileDeliverables } from '@/lib/deliverables/reconcile'

// Pabbly Connect webhook — fires on each new WordPress blog post (RSS or
// WP-trigger flow). Mirrors the daily WP cron's behavior for a single post:
// upserts raw_wordpress + posts, then reconciles wp_post deliverables for
// the matched client. Idempotent on (client_id, post_id, post_type) so
// Pabbly retries don't dupe.
//
// Auth: shared secret via `x-pabbly-secret` header (set PABBLY_WEBHOOK_SECRET
// in Vercel env vars; same value goes into the Pabbly action's custom headers).
//
// Client resolution: explicit `client_id` field wins. If absent, we resolve
// by matching the URL's hostname to clients.primary_domain.
//
// Expected payload (only `title`, `url`, and `external_id` are required;
// every other field is optional and falls back sensibly):
//   {
//     "title":             "...",          // required
//     "url":               "...",          // required (full post URL)
//     "external_id":       "12345",        // required — WP post ID
//     "client_id":         "uuid",         // optional, recommended
//     "published_at":      "ISO timestamp",
//     "modified_at":       "ISO timestamp",
//     "slug":              "...",
//     "excerpt":           "...",
//     "content_html":      "...",
//     "categories":        ["..."],
//     "tags":              ["..."],
//     "language":          "en" | "es" | null,
//     "post_type":         "post" | "page",
//     "post_status":       "publish" | "..."
//   }
type PabblyPayload = {
  title?: unknown
  url?: unknown
  external_id?: unknown
  client_id?: unknown
  published_at?: unknown
  modified_at?: unknown
  slug?: unknown
  excerpt?: unknown
  content_html?: unknown
  categories?: unknown
  tags?: unknown
  language?: unknown
  post_type?: unknown
  post_status?: unknown
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-pabbly-secret')
  if (!process.env.PABBLY_WEBHOOK_SECRET || secret !== process.env.PABBLY_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: PabblyPayload
  try {
    body = (await req.json()) as PabblyPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const externalId =
    body.external_id != null ? String(body.external_id) : ''

  if (!title || !url || !externalId) {
    return NextResponse.json(
      { ok: false, error: 'missing required fields: title, url, external_id' },
      { status: 400 }
    )
  }

  const supa = createAdminClient()

  // Resolve client_id — explicit wins, else match by hostname
  let clientId =
    typeof body.client_id === 'string' && body.client_id.length > 0
      ? body.client_id
      : null
  if (!clientId) {
    let host: string | null = null
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      // invalid URL — fall through
    }
    if (host) {
      const { data: matched } = await supa
        .from('clients')
        .select('id')
        .eq('primary_domain', host)
        .maybeSingle()
      clientId = matched?.id ?? null
    }
  }

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: 'client_id not provided and could not be resolved from url' },
      { status: 400 }
    )
  }

  const publishedAt =
    typeof body.published_at === 'string' ? body.published_at : new Date().toISOString()
  const modifiedAt =
    typeof body.modified_at === 'string' ? body.modified_at : publishedAt
  const slug =
    typeof body.slug === 'string' && body.slug.length > 0
      ? body.slug
      : (() => {
          try {
            return new URL(url).pathname.split('/').filter(Boolean).pop() ?? null
          } catch {
            return null
          }
        })()
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt : null
  const contentHtml = typeof body.content_html === 'string' ? body.content_html : ''
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((x): x is string => typeof x === 'string')
    : []
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((x): x is string => typeof x === 'string')
    : []
  const language = typeof body.language === 'string' ? body.language : null
  const postType = body.post_type === 'page' ? 'page' : 'post'
  const postStatus =
    typeof body.post_status === 'string' ? body.post_status : 'publish'
  const sourceType = postType === 'page' ? 'wp_page' : 'wp_post'

  const start = Date.now()

  // Upsert raw_wordpress (this is what reconcileDeliverables actually reads)
  const { error: rawErr } = await supa.from('raw_wordpress').upsert(
    {
      client_id: clientId,
      post_id: externalId,
      slug,
      title,
      content_html: contentHtml,
      post_type: postType,
      post_status: postStatus,
      categories,
      tags,
      language,
      url,
      modified_at: modifiedAt,
      fetched_at: new Date().toISOString(),
      raw_json: body as unknown as Record<string, unknown>,
    },
    { onConflict: 'client_id,post_id,post_type' }
  )

  if (rawErr) {
    await supa.from('sync_log').insert({
      source: 'webhook:pabbly-wordpress',
      client_id: clientId,
      status: 'error',
      error_message: `raw_wordpress: ${rawErr.message}`,
    })
    return NextResponse.json({ ok: false, error: rawErr.message }, { status: 500 })
  }

  // Upsert normalized posts (this is what /overview RecentUpdates reads)
  const { error: postsErr } = await supa.from('posts').upsert(
    {
      client_id: clientId,
      source_type: sourceType,
      external_id: externalId,
      slug,
      title,
      excerpt,
      categories,
      tags,
      language,
      published_at: publishedAt,
      modified_at: modifiedAt,
      url,
    },
    { onConflict: 'client_id,source_type,external_id' }
  )

  if (postsErr) {
    await supa.from('sync_log').insert({
      source: 'webhook:pabbly-wordpress',
      client_id: clientId,
      status: 'error',
      error_message: `posts: ${postsErr.message}`,
    })
    return NextResponse.json({ ok: false, error: postsErr.message }, { status: 500 })
  }

  // Reconcile wp_post-tracked deliverables for this client
  const reconcileResult = await reconcileDeliverables(supa, 'wp_post', clientId)

  await supa.from('sync_log').insert({
    source: 'webhook:pabbly-wordpress',
    client_id: clientId,
    status: 'ok',
    row_count: 1,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    client_id: clientId,
    external_id: externalId,
    deliverables_updated: reconcileResult.updated,
    deliverables_completed: reconcileResult.flipped_done,
  })
}
