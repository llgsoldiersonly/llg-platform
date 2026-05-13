// Derives per-competitor stats from the SERP snapshots we already collect
// weekly. The Competitors page in /seo/competitors uses these to answer:
//   - How does this competitor show up in MY keywords?
//   - When we both rank, how far ahead are they?
//   - Which specific keywords should I focus on closing the gap on?
//
// Zero new DataForSEO calls — pure aggregation over dfs_keyword_rank_snapshots.

import type { SupabaseClient } from '@supabase/supabase-js'

export type CompetitorStats = {
  competitor_id: string
  competitor_name: string
  competitor_domain: string | null
  is_active: boolean
  // # of client keywords this competitor appeared in (top-10) this month.
  keywords_overlapped: number
  // # of those where the competitor outranked the client.
  times_outranking: number
  // Average rank-position gap (positive = competitor is ahead) across the
  // overlapping keywords where the competitor outranked the client.
  avg_rank_gap: number | null
  // Top 3 (lowest-gap-first) keywords the client could most realistically
  // close on. Shown as concrete examples to the client.
  top_close_gap_keywords: Array<{
    keyword: string
    competitor_rank: number
    client_rank: number | null
  }>
  // Most recent date this competitor was observed in any of the client's SERPs.
  last_seen: string | null
}

type CompetitorRow = {
  id: string
  competitor_name: string
  competitor_domain: string | null
  is_active: boolean
}

type SnapshotRow = {
  keyword: string
  rank_absolute: number | null
  is_client_ranking: boolean | null
  snapshot_date: string
  top_competitors: unknown
}

export async function buildCompetitorStats(
  supa: SupabaseClient,
  clientId: string
): Promise<CompetitorStats[]> {
  const monthKey = new Date().toISOString().slice(0, 7)

  const [competitorsRes, snapshotsRes] = await Promise.all([
    supa
      .from('dfs_competitor_sites')
      .select('id, competitor_name, competitor_domain, is_active')
      .eq('client_id', clientId)
      .returns<CompetitorRow[]>(),
    supa
      .from('dfs_keyword_rank_snapshots')
      .select('keyword, rank_absolute, is_client_ranking, snapshot_date, top_competitors')
      .eq('client_id', clientId)
      .eq('month_key', monthKey)
      .eq('search_type', 'organic')
      .returns<SnapshotRow[]>(),
  ])

  const competitors = competitorsRes.data ?? []
  const snapshots = snapshotsRes.data ?? []
  if (competitors.length === 0) return []

  return competitors.map((c) => {
    let overlapped = 0
    let outranking = 0
    let gapSum = 0
    const closeGapCandidates: Array<{ keyword: string; competitor_rank: number; client_rank: number | null; gap: number }> = []
    let lastSeen: string | null = null

    for (const snap of snapshots) {
      const compArr = (snap.top_competitors ?? []) as Array<{
        domain?: string | null
        rank_absolute?: number | null
      }>
      if (!Array.isArray(compArr)) continue

      // Best (lowest) rank for this competitor in this SERP. Same competitor
      // can list multiple property pages; we treat the firm as one entity.
      let competitorRank: number | null = null
      for (const entry of compArr) {
        if (!entry?.domain) continue
        if (entry.domain.toLowerCase() !== (c.competitor_domain ?? '').toLowerCase()) continue
        const r = entry.rank_absolute ?? null
        if (r !== null && (competitorRank === null || r < competitorRank)) {
          competitorRank = r
        }
      }
      if (competitorRank === null) continue

      overlapped += 1
      if (lastSeen === null || snap.snapshot_date > lastSeen) {
        lastSeen = snap.snapshot_date
      }

      const clientRank = snap.is_client_ranking ? snap.rank_absolute ?? null : null
      // "Outranking" = client is missing OR ranks worse than competitor.
      const isOutranking = clientRank === null || competitorRank < clientRank
      if (isOutranking) {
        outranking += 1
        // Gap is undefined if client doesn't rank at all — we use 100 as a
        // sentinel for "client effectively off the map" so the close-gap
        // sort still works, but only count concrete gaps in the average.
        const effectiveClientRank = clientRank ?? 100
        gapSum += effectiveClientRank - competitorRank
        closeGapCandidates.push({
          keyword: snap.keyword,
          competitor_rank: competitorRank,
          client_rank: clientRank,
          gap: effectiveClientRank - competitorRank,
        })
      }
    }

    const avgGap = outranking > 0 ? Math.round((gapSum / outranking) * 10) / 10 : null

    // Top 3 by smallest gap (= easiest to close).
    closeGapCandidates.sort((a, b) => a.gap - b.gap)
    const topClose = closeGapCandidates.slice(0, 3).map(({ keyword, competitor_rank, client_rank }) => ({
      keyword,
      competitor_rank,
      client_rank,
    }))

    return {
      competitor_id: c.id,
      competitor_name: c.competitor_name,
      competitor_domain: c.competitor_domain,
      is_active: c.is_active,
      keywords_overlapped: overlapped,
      times_outranking: outranking,
      avg_rank_gap: avgGap,
      top_close_gap_keywords: topClose,
      last_seen: lastSeen,
    }
  })
}

// Returns a 1-sentence summary the page renders below each competitor row.
// Keeps the language plain and concrete; account managers can override per-
// competitor via the `notes` field on dfs_competitor_sites if needed.
export function actionLineForCompetitor(s: CompetitorStats): string {
  if (s.keywords_overlapped === 0) {
    return "Auto-discovered but not yet observed competing on your tracked keywords."
  }
  if (s.times_outranking === 0) {
    return `Appears alongside you in ${s.keywords_overlapped} keyword${s.keywords_overlapped === 1 ? '' : 's'} but doesn't outrank you. Hold the line.`
  }
  if (s.top_close_gap_keywords.length > 0) {
    const ex = s.top_close_gap_keywords[0]
    return `Outranks you on ${s.times_outranking} of your ${s.keywords_overlapped} overlapped keywords (avg ${s.avg_rank_gap} positions ahead). Closest gap: "${ex.keyword}".`
  }
  return `Outranks you on ${s.times_outranking} of your ${s.keywords_overlapped} overlapped keywords.`
}
