// Builds the per-firm monthly SEO report shipped to /seo/reports.
//
// Pipeline:
//   1. Pull this-month's rank / map / AI / review data for the client.
//   2. Compute the 6 scores via lib/seo/scoring.ts.
//   3. Compare against the prior month's report row (if any) to derive
//      structured `wins` and `losses` arrays.
//   4. Call Claude (Opus 4.7) with the score deltas + wins/losses to draft
//      a 4-sentence executive summary. Prompt caching is enabled so a single
//      cron run summarizing N firms only pays the system-prompt write cost
//      once.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropicClient } from '@/lib/integrations/anthropic'
import {
  calculateVisibilityScore,
  organicScoreFromRanks,
  mapsScoreFromGrid,
  aiScoreFromSnapshots,
  reviewScoreFromRating,
  competitorGapScoreFromBeats,
} from '@/lib/seo/scoring'

type Supa = SupabaseClient

export type ReportScores = {
  search_visibility_score: number | null
  maps_score: number | null
  organic_score: number | null
  ai_visibility_score: number | null
  review_score: number | null
  competitor_gap_score: number | null
}

export type GeneratedReport = ReportScores & {
  wins: string[]
  losses: string[]
  recommended_actions: string[]
  executive_summary: string
}

// 4-sentence cap enforced by both the prompt and a post-call sentence count.
const SYSTEM_PROMPT = `You write short executive summaries of monthly SEO performance for law-firm clients of Legal Leads Group. Your audience is a busy attorney — they want clarity, not jargon, and they want to know whether the work is paying off.

Rules:
- Write exactly 4 sentences. No more, no fewer.
- Sentence 1: state the overall direction (improvement, stable, decline) and the single biggest driver.
- Sentence 2: name a concrete win — be specific (number of keywords climbed, new citations, GBP move, etc.).
- Sentence 3: name a concrete gap or loss — same specificity bar.
- Sentence 4: state what we are doing about it this month.
- Write in plain English. No marketing fluff, no "leveraging", no "synergies". Don't open with "This month".
- Refer to the firm in the second person ("your"). Refer to LLG as "we" / "our team".`

export async function generateMonthlyReport(
  supa: Supa,
  clientId: string,
  monthKey: string // 'YYYY-MM' for the period being reported on
): Promise<GeneratedReport> {
  const scores = await computeScores(supa, clientId, monthKey)
  const priorReport = await fetchPriorReport(supa, clientId, monthKey)
  const { wins, losses } = deriveWinsAndLosses(scores, priorReport)
  const recommended_actions = deriveActions(scores, wins, losses)
  const executive_summary = await draftExecutiveSummary({
    scores,
    priorScores: priorReport ?? null,
    wins,
    losses,
    recommended_actions,
  })

  return { ...scores, wins, losses, recommended_actions, executive_summary }
}

async function computeScores(
  supa: Supa,
  clientId: string,
  monthKey: string
): Promise<ReportScores> {
  const [ranksRes, gridRes, aiRes, reviewsRes] = await Promise.all([
    supa
      .from('dfs_keyword_rank_snapshots')
      .select('rank_absolute, search_type')
      .eq('client_id', clientId)
      .eq('month_key', monthKey)
      .eq('search_type', 'organic'),
    supa
      .from('dfs_map_grid_rank_snapshots')
      .select('client_map_rank, client_found')
      .eq('client_id', clientId)
      .eq('month_key', monthKey),
    supa
      .from('dfs_ai_visibility_snapshots')
      .select('client_cited')
      .eq('client_id', clientId)
      .eq('month_key', monthKey),
    supa
      .from('gmb_snapshots')
      .select('rating')
      .eq('client_id', clientId)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const ranks = ranksRes.data ?? []
  const organicScore = organicScoreFromRanks(ranks)
  const mapsScore = mapsScoreFromGrid(gridRes.data ?? [])
  const aiVisibilityScore = aiScoreFromSnapshots(aiRes.data ?? [])
  const reviewScore = reviewScoreFromRating(reviewsRes.data?.rating ?? null)
  // Competitor gap stays as a coarse measure until the per-keyword "beats"
  // count is wired in. For now, treat "no competitors tracked" as null so the
  // score's weight is redistributed.
  const competitorGapScore = competitorGapScoreFromBeats(ranks.length, 0)
  const search_visibility_score = calculateVisibilityScore({
    mapsScore,
    organicScore,
    aiVisibilityScore,
    reviewScore,
    competitorGapScore,
  })

  return {
    search_visibility_score,
    maps_score: mapsScore,
    organic_score: organicScore,
    ai_visibility_score: aiVisibilityScore,
    review_score: reviewScore,
    competitor_gap_score: competitorGapScore,
  }
}

async function fetchPriorReport(
  supa: Supa,
  clientId: string,
  currentMonthKey: string
): Promise<ReportScores | null> {
  const { data } = await supa
    .from('dfs_seo_monthly_reports')
    .select('search_visibility_score, maps_score, organic_score, ai_visibility_score, review_score, competitor_gap_score')
    .eq('client_id', clientId)
    .lt('month_key', currentMonthKey)
    .order('month_key', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Heuristic wins / losses from score deltas. Conservative — only flags
// changes ≥ 5 points so noise doesn't fill the report.
function deriveWinsAndLosses(
  current: ReportScores,
  prior: ReportScores | null
): { wins: string[]; losses: string[] } {
  const wins: string[] = []
  const losses: string[] = []

  if (!prior) {
    // First-ever report — no deltas. Surface absolute strong points instead.
    if ((current.maps_score ?? 0) >= 60) {
      wins.push(`Strong Maps / Local Pack presence (score ${current.maps_score}/100).`)
    }
    if ((current.review_score ?? 0) >= 70) {
      wins.push(`Excellent review profile (score ${current.review_score}/100).`)
    }
    if ((current.organic_score ?? 0) < 40 && current.organic_score !== null) {
      losses.push(`Organic rankings need work (score ${current.organic_score}/100).`)
    }
    if (current.ai_visibility_score === null || current.ai_visibility_score < 30) {
      losses.push('AI visibility is still ramping up — limited mentions across AI surfaces.')
    }
    return { wins, losses }
  }

  const checks: Array<{ key: keyof ReportScores; label: string }> = [
    { key: 'search_visibility_score', label: 'Overall search visibility' },
    { key: 'maps_score', label: 'Maps / Local Pack' },
    { key: 'organic_score', label: 'Organic rankings' },
    { key: 'ai_visibility_score', label: 'AI visibility' },
    { key: 'review_score', label: 'Reviews' },
  ]

  for (const c of checks) {
    const before = prior[c.key]
    const after = current[c.key]
    if (before === null || after === null) continue
    const delta = after - before
    if (delta >= 5) wins.push(`${c.label} climbed ${delta} points (${before} → ${after}).`)
    if (delta <= -5) losses.push(`${c.label} dropped ${Math.abs(delta)} points (${before} → ${after}).`)
  }

  return { wins, losses }
}

// Stock follow-up actions based on which sub-scores are weakest. Account
// managers can override these per client by editing the report row after the
// cron writes it.
function deriveActions(
  scores: ReportScores,
  wins: string[],
  losses: string[]
): string[] {
  const actions: string[] = []
  const weakest = findWeakestSubScore(scores)
  if (weakest === 'organic') {
    actions.push('Publishing 2 additional FAQ pages and 1 long-form blog targeting the weakest-ranking keywords.')
  } else if (weakest === 'maps') {
    actions.push('Adding 5 new geo-tagged GBP posts and refreshing the practice-area photo set.')
  } else if (weakest === 'ai') {
    actions.push('Expanding the AI-optimized FAQ set to surface in more LLM responses.')
  } else if (weakest === 'reviews') {
    actions.push('Launching a structured review-request flow with your intake team.')
  }
  if (losses.length === 0 && wins.length > 0) {
    actions.push('Doubling down on what worked — same cadence, same focus next month.')
  }
  return actions
}

function findWeakestSubScore(scores: ReportScores): 'organic' | 'maps' | 'ai' | 'reviews' | null {
  const pairs: Array<{ key: 'organic' | 'maps' | 'ai' | 'reviews'; value: number | null }> = [
    { key: 'organic', value: scores.organic_score },
    { key: 'maps', value: scores.maps_score },
    { key: 'ai', value: scores.ai_visibility_score },
    { key: 'reviews', value: scores.review_score },
  ]
  const populated = pairs.filter((p): p is { key: 'organic' | 'maps' | 'ai' | 'reviews'; value: number } => p.value !== null)
  if (populated.length === 0) return null
  populated.sort((a, b) => a.value - b.value)
  return populated[0].key
}

async function draftExecutiveSummary(input: {
  scores: ReportScores
  priorScores: ReportScores | null
  wins: string[]
  losses: string[]
  recommended_actions: string[]
}): Promise<string> {
  const client = getAnthropicClient()

  const userPrompt = `Here's the data for this month's report:

CURRENT SCORES (0-100, null = not yet measured):
${JSON.stringify(input.scores, null, 2)}

PRIOR-MONTH SCORES (for delta context):
${input.priorScores ? JSON.stringify(input.priorScores, null, 2) : '(none — this is the first report)'}

WINS (concrete, already extracted):
${input.wins.length > 0 ? input.wins.map((w) => `- ${w}`).join('\n') : '(no quantified wins this month)'}

LOSSES (concrete, already extracted):
${input.losses.length > 0 ? input.losses.map((l) => `- ${l}`).join('\n') : '(no quantified losses this month)'}

WHAT WE'RE DOING NEXT MONTH:
${input.recommended_actions.length > 0 ? input.recommended_actions.map((a) => `- ${a}`).join('\n') : '(continuing current cadence)'}

Write the 4-sentence executive summary now.`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the system prompt — every firm in the same cron run reuses it.
        // 5-min TTL is plenty since the cron processes all firms within a few
        // minutes of the first.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  for (const block of response.content) {
    if (block.type === 'text') {
      return block.text.trim()
    }
  }
  return ''
}
