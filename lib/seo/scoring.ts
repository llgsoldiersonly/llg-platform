// Search Visibility Score — single 0-100 number clients can hold in their head.
//
// Weighting (handoff §7):
//   40% Maps / Local Pack visibility
//   25% Organic rankings
//   15% AI visibility
//   10% Review strength
//   10% Competitor gap
//
// Each sub-score is itself 0-100. When data for a sub-score is missing the
// score returns null and the weight is redistributed pro-rata across the
// available sub-scores so a fresh client (no map grid yet, no AI mentions
// yet) still gets a fair number from whatever is populated.

export type SubScores = {
  mapsScore: number | null
  organicScore: number | null
  aiVisibilityScore: number | null
  reviewScore: number | null
  competitorGapScore: number | null
}

const WEIGHTS = {
  mapsScore: 0.4,
  organicScore: 0.25,
  aiVisibilityScore: 0.15,
  reviewScore: 0.1,
  competitorGapScore: 0.1,
} as const

export function calculateVisibilityScore(scores: SubScores): number | null {
  let totalWeight = 0
  let weightedSum = 0
  for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof SubScores, number]>) {
    const value = scores[key]
    if (value === null || !Number.isFinite(value)) continue
    totalWeight += weight
    weightedSum += clamp(value, 0, 100) * weight
  }
  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

// ---------------------------------------------------------------
// Sub-score builders. Each takes raw counts from the dfs_* tables
// and returns a 0-100 figure (or null if there's nothing to score).
// ---------------------------------------------------------------

// % of tracked organic keywords ranking in the top 10.
export function organicScoreFromRanks(ranks: Array<{ rank_absolute: number | null }>): number | null {
  if (ranks.length === 0) return null
  const inTop10 = ranks.filter((r) => r.rank_absolute !== null && r.rank_absolute <= 10).length
  return Math.round((inTop10 / ranks.length) * 100)
}

// % of (grid point × keyword) pairs where the client appears in the top 3.
export function mapsScoreFromGrid(
  points: Array<{ client_map_rank: number | null; client_found: boolean }>
): number | null {
  if (points.length === 0) return null
  const top3 = points.filter((p) => p.client_found && (p.client_map_rank ?? 99) <= 3).length
  return Math.round((top3 / points.length) * 100)
}

// % of AI snapshots where the client was cited.
export function aiScoreFromSnapshots(
  snapshots: Array<{ client_cited: boolean }>
): number | null {
  if (snapshots.length === 0) return null
  const cited = snapshots.filter((s) => s.client_cited).length
  return Math.round((cited / snapshots.length) * 100)
}

// Star rating (0-5) → 0-100. Anything ≥ 4.5 hits the ceiling fast since that
// caliber of rating is what a client of ours should aim for.
export function reviewScoreFromRating(rating: number | null): number | null {
  if (rating === null || rating <= 0) return null
  return Math.min(100, Math.round((rating / 4.7) * 100))
}

// 100 = client at parity or ahead of competitors; 0 = competitors dominate.
// Input: how many tracked keywords each competitor outranks the client on,
// summed and normalized against the total tracked-keyword count.
export function competitorGapScoreFromBeats(
  totalTrackedKeywords: number,
  competitorBeatsCount: number
): number | null {
  if (totalTrackedKeywords === 0) return null
  const ratio = competitorBeatsCount / totalTrackedKeywords
  return Math.max(0, Math.round((1 - ratio) * 100))
}

// ---------------------------------------------------------------
// Display helpers — color band + plain-English label for a 0-100 score.
// ---------------------------------------------------------------
export type ScoreBand = 'great' | 'good' | 'fair' | 'poor' | 'unknown'

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return 'unknown'
  if (score >= 80) return 'great'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

export function scoreLabel(score: number | null): string {
  switch (scoreBand(score)) {
    case 'great': return 'Excellent'
    case 'good':  return 'On track'
    case 'fair':  return 'Needs attention'
    case 'poor':  return 'Behind'
    default:      return 'Not enough data yet'
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
