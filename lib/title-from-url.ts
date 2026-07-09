// Derive a readable title from a work URL's slug, for submissions where staff
// skipped the Title field: ".../top-10-car-accident-questions/" →
// "Top 10 car accident questions". Returns null when the URL has no usable
// path (bare domain, numeric IDs, query-only links).
export function titleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // YouTube URLs carry an opaque video ID, never a readable slug — a derived
  // "title" would be garbage like "RI0CqM9zvis". Label them plainly instead.
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    return 'New YouTube video'
  }
  const segments = parsed.pathname.split('/').filter(Boolean)
  // Walk from the end past junk segments (pure numbers, index files).
  for (let i = segments.length - 1; i >= 0; i--) {
    const raw = segments[i].replace(/\.(html?|php|aspx?)$/i, '')
    const decoded = (() => {
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    })()
    const words = decoded.replace(/[-_+]+/g, ' ').trim()
    // Skip segments with no letters (ids, dates) or too short to mean anything.
    if (!/[a-zA-Z]{3,}/.test(words)) continue
    if (/^index$/i.test(words)) continue
    return words.charAt(0).toUpperCase() + words.slice(1)
  }
  return null
}
