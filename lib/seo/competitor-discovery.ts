// Derives a firm's local competitors from existing SERP data — zero new
// DataForSEO calls. Logic:
//   1. Pull this month's `dfs_keyword_rank_snapshots` for the firm.
//   2. Each row's `top_competitors` jsonb is the top-10 SERP results we
//      already captured during the weekly refresh.
//   3. Count distinct domains across all rows, excluding:
//      - the firm's own domain
//      - well-known directory / aggregator sites (avvo, justia, findlaw …)
//      - knowledge / social / video platforms (wikipedia, yelp, youtube …)
//   4. Take the top N most-frequent remaining domains as competitors.

export type RankSnapshotForDiscovery = {
  top_competitors: unknown
}

const DIRECTORY_DOMAINS = new Set([
  'avvo.com',
  'justia.com',
  'findlaw.com',
  'lawyers.com',
  'martindale.com',
  'superlawyers.com',
  'lawinfo.com',
  'expertise.com',
  'thumbtack.com',
  'angi.com',
  'angieslist.com',
  'lawyerlegion.com',
  'lawfirms.com',
  'attorneys.com',
  'best-attorneys.com',
  'bestlawyers.com',
  'lawhelp.org',
  'nolo.com',
  'enjuris.com',
  'forthepeople.com', // Morgan & Morgan — too large; not a local competitor
])

const SOCIAL_OR_KNOWLEDGE = new Set([
  'wikipedia.org',
  'en.wikipedia.org',
  'yelp.com',
  'youtube.com',
  'reddit.com',
  'quora.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'bbb.org',
  'yellowpages.com',
  'maps.google.com',
  'google.com',
])

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = String(raw).toLowerCase().trim()
  d = d.replace(/^https?:\/\//, '')
  d = d.split('/')[0]
  d = d.replace(/^www\./, '')
  // Drop port
  d = d.split(':')[0]
  if (!d || !d.includes('.')) return null
  return d
}

// Returns true when the candidate is either the directory itself OR a
// subdomain of it. Catches cases like `attorneys.superlawyers.com` (which
// should be filtered out because superlawyers.com is a directory) without
// requiring every subdomain to be enumerated in the filter sets.
function isInDomainSet(candidate: string, set: Set<string>): boolean {
  if (set.has(candidate)) return true
  for (const known of set) {
    if (candidate.endsWith(`.${known}`)) return true
  }
  return false
}

export type DiscoveredCompetitor = {
  domain: string
  occurrence_count: number
}

export function discoverCompetitorsFromSnapshots(
  snapshots: RankSnapshotForDiscovery[],
  clientDomain: string | null,
  maxResults = 5
): DiscoveredCompetitor[] {
  const clientDomainNorm = normalizeDomain(clientDomain)
  const counts = new Map<string, number>()

  for (const snap of snapshots) {
    const competitors = snap.top_competitors as Array<{ domain?: string | null; url?: string | null }> | null
    if (!Array.isArray(competitors)) continue

    // Within a single SERP, only count each unique domain once so a firm
    // that owns the entire page (multiple property listings) doesn't get
    // inflated against firms that only appear once.
    const seenInThisSerp = new Set<string>()

    for (const c of competitors) {
      const domain = normalizeDomain(c.domain ?? c.url ?? null)
      if (!domain) continue
      if (isInDomainSet(domain, DIRECTORY_DOMAINS)) continue
      if (isInDomainSet(domain, SOCIAL_OR_KNOWLEDGE)) continue
      if (clientDomainNorm && domain === clientDomainNorm) continue
      if (seenInThisSerp.has(domain)) continue
      seenInThisSerp.add(domain)
      counts.set(domain, (counts.get(domain) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([domain, occurrence_count]) => ({ domain, occurrence_count }))
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, maxResults)
}
