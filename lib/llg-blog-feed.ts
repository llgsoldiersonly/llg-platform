// Fetches latest posts from legalleadsgroup.com via WordPress REST API.
// Cached at the edge for 1h so we don't pummel the corporate site on every
// portal load.

const LLG_POSTS_URL =
  'https://legalleadsgroup.com/wp-json/wp/v2/posts?per_page=4&_embed=wp:featuredmedia'

export type LlgBlogPost = {
  id: number
  title: string
  link: string
  publishedAt: string
  featuredImageUrl: string | null
}

type RawPost = {
  id: number
  date: string
  link: string
  title: { rendered: string }
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url?: string
      media_details?: {
        sizes?: Record<string, { source_url?: string }>
      }
    }>
  }
}

function decodeEntities(s: string): string {
  // WP REST returns titles with HTML entities (&amp; &#8217; etc.). Decode
  // the few we actually see; full decoder would pull in extra weight.
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function pickImage(post: RawPost): string | null {
  const media = post._embedded?.['wp:featuredmedia']?.[0]
  if (!media) return null
  // Prefer a mid-size thumbnail when WP exposes one; fall back to the full
  // source_url.
  const sizes = media.media_details?.sizes
  return (
    sizes?.medium_large?.source_url ??
    sizes?.medium?.source_url ??
    sizes?.large?.source_url ??
    media.source_url ??
    null
  )
}

export async function fetchLlgBlogPosts(): Promise<LlgBlogPost[]> {
  try {
    const res = await fetch(LLG_POSTS_URL, {
      // Refetch hourly; corporate blog doesn't post more often than that.
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const raw = (await res.json()) as RawPost[]
    return raw.map((p) => ({
      id: p.id,
      title: decodeEntities(p.title.rendered),
      link: p.link,
      publishedAt: p.date,
      featuredImageUrl: pickImage(p),
    }))
  } catch {
    // Network or parse failure → empty list. The card shows an empty state.
    return []
  }
}
