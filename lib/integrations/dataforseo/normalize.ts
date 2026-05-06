// Domain / URL normalizers for DataForSEO targets.
//
// DataForSEO expects bare domains (`example.com`) for backlink/SERP queries —
// stripping protocol, www, paths, and query strings. URLs (for backlink
// items and SERP results) keep their full form but are minimally cleaned.

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return ''

  try {
    const withProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

// True when `candidate` matches the client's domain or any subdomain of it.
// Used to detect whether a SERP item belongs to the client.
export function isSameOrSubdomain(candidate: string, clientDomain: string): boolean {
  const a = normalizeDomain(candidate)
  const b = normalizeDomain(clientDomain)
  if (!a || !b) return false
  return a === b || a.endsWith(`.${b}`)
}
