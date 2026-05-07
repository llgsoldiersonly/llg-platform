// Plain-English insight copy generators. The portal should never feel like a
// raw SEO tool — every metric block on the dashboard runs its numbers through
// one of these to render a sentence the firm actually wants to read.

export function backlinkInsightCopy(metrics: {
  newBacklinks: number
  lostBacklinks: number
  newReferringDomains: number
  lostReferringDomains: number
  spamScore?: number | null
}): string {
  const net = metrics.newBacklinks - metrics.lostBacklinks
  const spam = metrics.spamScore ?? 0

  if (spam >= 50) {
    return 'Spam score is elevated — we should prioritize clean local links from law-relevant directories and publishers, not just total volume.'
  }
  if (net > 0 && metrics.newReferringDomains > 0) {
    return `Backlink profile grew this month with ${metrics.newReferringDomains} new referring domain${metrics.newReferringDomains === 1 ? '' : 's'}. That's fresh trust pointing at the firm and supports ranking improvements over the next 30–60 days.`
  }
  if (net < 0) {
    return 'More links lost than gained this month. We should review the lost links and reclaim anything that came from a still-friendly source.'
  }
  if (metrics.newReferringDomains === 0) {
    return 'No new referring domains this month — authority growth is flat. Next move is press, citations, or directly-earned content links.'
  }
  return 'Backlink profile is stable. The opportunity now is to push high-quality referring domains rather than just maintain.'
}

export function rankingInsightCopy(metrics: {
  improved: number
  dropped: number
  top3: number
  top10: number
  total: number
}): string {
  if (metrics.total === 0) {
    return 'No tracked keywords yet. Once the SEO team adds the keywords this firm should win, weekly rank checks will run automatically.'
  }
  if (metrics.improved > metrics.dropped && metrics.top3 > 0) {
    return `${metrics.improved} keyword${metrics.improved === 1 ? '' : 's'} improved this month — ${metrics.top3} now sit${metrics.top3 === 1 ? 's' : ''} in the top 3.`
  }
  if (metrics.dropped > metrics.improved) {
    return `${metrics.dropped} keyword${metrics.dropped === 1 ? '' : 's'} dropped this month. Likely culprits: competitor content updates, technical issues, or weakened Google Business Profile signals.`
  }
  if (metrics.top10 > 0) {
    return `Visibility was steady this month. The next push is moving the ${metrics.top10 - metrics.top3} keyword${metrics.top10 - metrics.top3 === 1 ? '' : 's'} sitting in positions 4–10 into the top 3.`
  }
  return "No keywords are landing in the top 10 yet. We'll prioritize content + local citations to break in."
}

export function aiVisibilityInsightCopy(metrics: {
  mentions: number
  citations: number
  competitorMentions: number
}): string {
  if (metrics.mentions === 0 && metrics.competitorMentions > 0) {
    return 'Competitors are showing up in AI answers where this firm is missing. We should strengthen authority pages, attorney bios, FAQ content, and citation footprint.'
  }
  if (metrics.citations > 0) {
    return `The firm was cited in ${metrics.citations} AI answer${metrics.citations === 1 ? '' : 's'} this month — keep adding conversion-focused content to the cited pages.`
  }
  if (metrics.mentions > 0) {
    return 'The firm is being mentioned in AI answers but not yet linked as a citation. We should make the relevant pages more directly answerable so AI engines link out.'
  }
  return 'No AI visibility yet. Continue building authoritative, locally-specific content the AI systems can trust enough to cite.'
}

export function mapsInsightCopy(metrics: {
  totalGridPoints: number
  top3Count: number
  notFoundCount: number
}): string {
  if (metrics.totalGridPoints === 0) {
    return "Map grid isn't configured yet. Once the SEO team sets a 3×3 or 5×5 grid around the office, we can show coverage geographically."
  }
  const top3Pct = Math.round((metrics.top3Count / metrics.totalGridPoints) * 100)
  const missingPct = Math.round((metrics.notFoundCount / metrics.totalGridPoints) * 100)
  if (top3Pct >= 60) {
    return `Strong map presence — ${top3Pct}% of the grid shows the firm in the top 3. We should defend by keeping reviews + GBP posts consistent.`
  }
  if (top3Pct >= 30) {
    return `${top3Pct}% of the grid puts the firm in the top 3. The next quarter goal is pushing the orange/red zones into the top 10.`
  }
  if (missingPct > 50) {
    return `Most of the grid is missing the firm entirely (${missingPct}%). That points to a Google Business Profile completeness issue, weak citations, or distance from the GBP-listed address.`
  }
  return 'Map visibility is uneven. Reviews velocity, GBP completeness, and locally-cited content are the levers that move it.'
}

export function competitorGapInsightCopy(metrics: {
  competitorCount: number
  beatenCount: number
  competingCount: number
}): string {
  if (metrics.competitorCount === 0) {
    return "No competitors tracked yet. Once 3–5 local competitors are added, we'll surface where they're winning and where there's room to take share."
  }
  if (metrics.beatenCount > 0 && metrics.beatenCount >= metrics.competingCount) {
    return `${metrics.beatenCount} of ${metrics.competitorCount} tracked competitors are still ranking above the firm on important keywords. That's where the next wave of content + links should aim.`
  }
  if (metrics.competingCount > 0) {
    return `Holding parity with most tracked competitors. The opportunity is targeted content for the queries where they still have the edge.`
  }
  return 'Competitive picture is thin so far — keep tracking and we will show the gap analysis as data accrues.'
}
