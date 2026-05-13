// Builds the keyword set we test against AI surfaces each month.
//
// Strategy (per Nathan, 2026-05-13):
//   1. Pull all high/medium-priority tracked keywords for the firm.
//   2. For each, look up the client's current rank from this month's
//      dfs_keyword_rank_snapshots. Keywords where the client already
//      ranks in the top 10 organically are MUCH more likely to surface
//      in AI responses, so we boost them.
//   3. Order: top-10-ranking-keywords first (by rank ascending), then
//      remaining high-priority, then remaining medium-priority.
//   4. Take the top N (default 6).

import type { SupabaseClient } from '@supabase/supabase-js'

export type SourcedKeyword = {
  tracked_keyword_id: string
  keyword: string
  city: string | null
  state: string | null
  // The current rank (null if not in top-100). Used for sorting; not exposed
  // to the prompt generator.
  current_rank: number | null
  priority: 'high' | 'medium' | 'low' | null
}

type TrackedRow = {
  id: string
  keyword: string
  city: string | null
  state: string | null
  priority: 'high' | 'medium' | 'low' | null
  is_active: boolean
}

type RankRow = {
  tracked_keyword_id: string | null
  rank_absolute: number | null
  is_client_ranking: boolean | null
}

const DEFAULT_MAX = 6

export async function gatherKeywordsForAiVisibility(
  supa: SupabaseClient,
  clientId: string,
  max = DEFAULT_MAX
): Promise<SourcedKeyword[]> {
  const monthKey = new Date().toISOString().slice(0, 7)

  const [trackedRes, ranksRes] = await Promise.all([
    supa
      .from('dfs_tracked_keywords')
      .select('id, keyword, city, state, priority, is_active')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .in('priority', ['high', 'medium'])
      .returns<TrackedRow[]>(),
    supa
      .from('dfs_keyword_rank_snapshots')
      .select('tracked_keyword_id, rank_absolute, is_client_ranking')
      .eq('client_id', clientId)
      .eq('month_key', monthKey)
      .eq('search_type', 'organic')
      .returns<RankRow[]>(),
  ])

  const tracked = trackedRes.data ?? []
  if (tracked.length === 0) return []

  // Best (lowest) rank per tracked_keyword this month. A keyword may have
  // multiple snapshots (different devices, repeat runs) — we want the best
  // case so the AI is most likely to surface the firm.
  const bestRankByTrackedId = new Map<string, number>()
  for (const r of ranksRes.data ?? []) {
    if (!r.tracked_keyword_id || !r.is_client_ranking) continue
    if (r.rank_absolute === null) continue
    const prev = bestRankByTrackedId.get(r.tracked_keyword_id)
    if (prev === undefined || r.rank_absolute < prev) {
      bestRankByTrackedId.set(r.tracked_keyword_id, r.rank_absolute)
    }
  }

  const sourced: SourcedKeyword[] = tracked.map((t) => ({
    tracked_keyword_id: t.id,
    keyword: t.keyword,
    city: t.city,
    state: t.state,
    priority: t.priority,
    current_rank: bestRankByTrackedId.get(t.id) ?? null,
  }))

  // Sort order:
  //   1. Currently ranking in top 10 (best chance of AI mention) — by rank asc
  //   2. High priority, not yet ranking — keep order DFS returned them
  //   3. Medium priority, not yet ranking
  sourced.sort((a, b) => {
    const aTop10 = a.current_rank !== null && a.current_rank <= 10
    const bTop10 = b.current_rank !== null && b.current_rank <= 10
    if (aTop10 && !bTop10) return -1
    if (!aTop10 && bTop10) return 1
    if (aTop10 && bTop10) {
      return (a.current_rank ?? 999) - (b.current_rank ?? 999)
    }
    // Neither in top 10 — prefer high over medium
    if (a.priority === 'high' && b.priority !== 'high') return -1
    if (a.priority !== 'high' && b.priority === 'high') return 1
    return 0
  })

  return sourced.slice(0, max)
}
