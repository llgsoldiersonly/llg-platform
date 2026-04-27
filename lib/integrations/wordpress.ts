// WordPress REST API client. Pulls posts via App Password auth.
// One auth pair per client; stored in client_credentials.

export type WpEmbeddedTerm = {
  id: number
  taxonomy: 'category' | 'post_tag' | string
  slug: string
  name?: string
}

export type WpPost = {
  id: number
  slug: string
  title: { rendered: string }
  excerpt: { rendered: string }
  content: { rendered: string }
  status: string
  type: 'post' | 'page' | string
  link: string
  date_gmt: string
  modified_gmt: string
  meta?: Record<string, string | number | boolean | null>
  lang?: string                        // Polylang exposes this
  _embedded?: {
    'wp:term'?: WpEmbeddedTerm[][]    // [categories, tags] arrays
  }
  raw?: unknown                        // For storage as raw_json
}

export type WpFetchOpts = {
  domain: string                        // 'danielslawpa.com' (no protocol)
  username: string
  appPassword: string
  modifiedAfter?: Date                  // ISO timestamp filter
  perPage?: number
  postType?: 'posts' | 'pages'
}

/**
 * Fetch posts modified after a cutoff. Uses ?_embed=wp:term to get
 * categories + tags inline (no second roundtrip per post).
 *
 * Auto-paginates up to 10 pages (1000 posts) per call. Cron can re-pull
 * stragglers next run via modified_after.
 */
export async function fetchWpPosts(opts: WpFetchOpts): Promise<WpPost[]> {
  const protocol = 'https'
  const perPage = opts.perPage ?? 100
  const postType = opts.postType ?? 'posts'
  const auth = Buffer.from(`${opts.username}:${opts.appPassword}`).toString('base64')

  const allPosts: WpPost[] = []
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      _embed: 'wp:term',
    })
    if (opts.modifiedAfter) {
      params.set('modified_after', opts.modifiedAfter.toISOString())
    }

    const url = `${protocol}://${opts.domain}/wp-json/wp/v2/${postType}?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': 'LLG-Platform/1.0',
      },
      // Don't cache — we want fresh data on every cron tick
      cache: 'no-store',
    })

    if (res.status === 400 && page > 1) break  // page out of range
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`WP fetch failed (${res.status}): ${body.slice(0, 300)}`)
    }

    const batch = (await res.json()) as WpPost[]
    if (batch.length === 0) break
    allPosts.push(...batch)
    if (batch.length < perPage) break
  }

  return allPosts
}

// Pulls term slugs out of the embedded payload. The categories array
// comes first, tags second.
export function extractTerms(post: WpPost): { categories: string[]; tags: string[] } {
  const embedded = post._embedded?.['wp:term'] ?? []
  const cats = (embedded[0] ?? [])
    .filter((t) => t.taxonomy === 'category')
    .map((t) => t.slug)
  const tags = (embedded[1] ?? [])
    .filter((t) => t.taxonomy === 'post_tag')
    .map((t) => t.slug)
  return { categories: cats, tags }
}
