// Builds the per-firm weekly SEO report shipped to /seo/weekly.
//
// Pipeline mirrors lib/seo/monthly-report-generator.ts, with three deltas:
//   1. Snapshots are aggregated over a 7-day window (ISO Mon → Sun) instead
//      of by month_key.
//   2. Claude returns BOTH a 4-sentence executive summary AND a 3-5 item
//      key_points array in a single JSON response.
//   3. The latest finalized monthly report's executive_summary is fetched
//      and stored verbatim as last_month_recap, giving readers a bigger-arc
//      reminder alongside the week-over-week detail.
//
// AI visibility is refreshed monthly (not weekly), so the AI score will be
// stable within a month and tick on the 1st. That's expected.

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

export type WeeklyReportScores = {
  search_visibility_score: number | null
  maps_score: number | null
  organic_score: number | null
  ai_visibility_score: number | null
  review_score: number | null
  competitor_gap_score: number | null
}

export type GeneratedWeeklyReport = WeeklyReportScores & {
  wins: string[]
  losses: string[]
  recommended_actions: string[]
  executive_summary: string
  key_points: string[]
  last_month_recap: string | null
}

const SYSTEM_PROMPT = `You write short weekly SEO performance updates for law-firm clients of Legal Leads Group. Your audience is a busy attorney — they want clarity, not jargon, and they want to know whether the work is paying off in the last 7 days.

You will output strict JSON with two fields:
  "executive_summary": exactly 4 sentences of plain English narrative.
  "key_points": 3 to 5 short bullets, each one fact, max 18 words.

Rules for the executive summary:
- Sentence 1: state the overall direction (improvement, stable, decline) this week and the single biggest driver.
- Sentence 2: name a concrete weekly win — be specific (keyword climbed N spots, new citation landed, GBP impressions up, etc.).
- Sentence 3: name a concrete weekly gap or loss — same specificity bar.
- Sentence 4: state what we are doing about it next week.
- No marketing fluff, no "leveraging", no "synergies". Don't open with "This week".
- Refer to the firm in the second person ("your"). Refer to LLG as "we" / "our team".

Rules for key_points:
- Each bullet is a single fact ready to skim, not a sentence chain.
- Prefer numbers ("+3 keywords in top 10", "2 new backlinks") over adjectives.
- At least one bullet must reference momentum vs. last week. At least one must reference an action we're taking.

Output JSON only. No prose, no code fence.`

export async function generateWeeklyReport(
  supa: Supa,
  clientId: string,
  weekKey: string,
  periodStart: string, // 'YYYY-MM-DD'
  periodEnd: string // 'YYYY-MM-DD'
): Promise<GeneratedWeeklyReport> {
  const scores = await computeScores(supa, clientId, periodStart, periodEnd)
  const priorReport = await fetchPriorWeekReport(supa, clientId, weekKey)
  const { wins, losses } = deriveWinsAndLosses(scores, priorReport)
  const recommended_actions = deriveActions(scores, wins, losses)
  const { executive_summary, key_points } = await draftSummaryAndKeyPoints({
    scores,
    priorScores: priorReport ?? null,
    wins,
    losses,
    recommended_actions,
    periodStart,
    periodEnd,
  })
  const last_month_recap = await fetchLastMonthRecap(supa, clientId)

  return {
    ...scores,
    wins,
    losses,
    recommended_actions,
    executive_summary,
    key_points,
    last_month_recap,
  }
}

async function computeScores(
  supa: Supa,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<WeeklyReportScores> {
  const [ranksRes, gridRes, aiRes, reviewsRes] = await Promise.all([
    supa
      .from('dfs_keyword_rank_snapshots')
      .select('rank_absolute, search_type')
      .eq('client_id', clientId)
      .gte('snapshot_date', periodStart)
      .lte('snapshot_date', periodEnd)
      .eq('search_type', 'organic'),
    supa
      .from('dfs_map_grid_rank_snapshots')
      .select('client_map_rank, client_found')
      .eq('client_id', clientId)
      .gte('snapshot_date', periodStart)
      .lte('snapshot_date', periodEnd),
    // AI visibility is monthly-cadence: pull the latest month's snapshots
    // regardless of period window so the score still populates.
    supa
      .from('dfs_ai_visibility_snapshots')
      .select('client_cited, snapshot_date')
      .eq('client_id', clientId)
      .order('snapshot_date', { ascending: false })
      .limit(200),
    supa
      .from('gmb_snapshots')
      .select('rating, captured_on')
      .eq('client_id', clientId)
      .lte('captured_on', periodEnd)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const ranks = ranksRes.data ?? []
  const organicScore = organicScoreFromRanks(ranks)
  const mapsScore = mapsScoreFromGrid(gridRes.data ?? [])
  const aiVisibilityScore = aiScoreFromSnapshots(aiRes.data ?? [])
  const reviewScore = reviewScoreFromRating(reviewsRes.data?.rating ?? null)
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

async function fetchPriorWeekReport(
  supa: Supa,
  clientId: string,
  currentWeekKey: string
): Promise<WeeklyReportScores | null> {
  const { data } = await supa
    .from('dfs_seo_weekly_reports')
    .select('search_visibility_score, maps_score, organic_score, ai_visibility_score, review_score, competitor_gap_score')
    .eq('client_id', clientId)
    .lt('week_key', currentWeekKey)
    .order('week_key', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function fetchLastMonthRecap(supa: Supa, clientId: string): Promise<string | null> {
  const { data } = await supa
    .from('dfs_seo_monthly_reports')
    .select('executive_summary')
    .eq('client_id', clientId)
    .order('month_key', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.executive_summary ?? null
}

// Heuristic wins / losses from week-over-week score deltas. Threshold of ≥3
// points (vs. monthly's ≥5) because week-to-week swings are smaller.
function deriveWinsAndLosses(
  current: WeeklyReportScores,
  prior: WeeklyReportScores | null
): { wins: string[]; losses: string[] } {
  const wins: string[] = []
  const losses: string[] = []

  if (!prior) {
    if ((current.maps_score ?? 0) >= 60) {
      wins.push(`Strong Maps / Local Pack presence (score ${current.maps_score}/100).`)
    }
    if ((current.review_score ?? 0) >= 70) {
      wins.push(`Excellent review profile (score ${current.review_score}/100).`)
    }
    if ((current.organic_score ?? 0) < 40 && current.organic_score !== null) {
      losses.push(`Organic rankings need work (score ${current.organic_score}/100).`)
    }
    return { wins, losses }
  }

  const checks: Array<{ key: keyof WeeklyReportScores; label: string }> = [
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
    if (delta >= 3) wins.push(`${c.label} climbed ${delta} points (${before} → ${after}).`)
    if (delta <= -3) losses.push(`${c.label} dropped ${Math.abs(delta)} points (${before} → ${after}).`)
  }

  return { wins, losses }
}

function deriveActions(
  scores: WeeklyReportScores,
  wins: string[],
  losses: string[]
): string[] {
  const actions: string[] = []
  const weakest = findWeakestSubScore(scores)
  if (weakest === 'organic') {
    actions.push('Drafting one targeted blog post against the weakest-ranking keyword for next week.')
  } else if (weakest === 'maps') {
    actions.push('Posting 2 fresh GBP updates and reviewing service-area coverage this week.')
  } else if (weakest === 'ai') {
    actions.push('Expanding the FAQ set so the firm surfaces in more LLM-generated answers.')
  } else if (weakest === 'reviews') {
    actions.push('Running the review-request flow with this week’s closed cases.')
  }
  if (losses.length === 0 && wins.length > 0) {
    actions.push('Holding the cadence — same playbook into next week.')
  }
  return actions
}

function findWeakestSubScore(scores: WeeklyReportScores): 'organic' | 'maps' | 'ai' | 'reviews' | null {
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

async function draftSummaryAndKeyPoints(input: {
  scores: WeeklyReportScores
  priorScores: WeeklyReportScores | null
  wins: string[]
  losses: string[]
  recommended_actions: string[]
  periodStart: string
  periodEnd: string
}): Promise<{ executive_summary: string; key_points: string[] }> {
  const client = getAnthropicClient()

  const userPrompt = `Here's the data for this week's report (${input.periodStart} → ${input.periodEnd}):

CURRENT SCORES (0-100, null = not yet measured):
${JSON.stringify(input.scores, null, 2)}

PRIOR-WEEK SCORES (for delta context):
${input.priorScores ? JSON.stringify(input.priorScores, null, 2) : '(none — this is the first weekly report)'}

WINS (concrete, already extracted):
${input.wins.length > 0 ? input.wins.map((w) => `- ${w}`).join('\n') : '(no quantified wins this week)'}

LOSSES (concrete, already extracted):
${input.losses.length > 0 ? input.losses.map((l) => `- ${l}`).join('\n') : '(no quantified losses this week)'}

WHAT WE'RE DOING NEXT WEEK:
${input.recommended_actions.length > 0 ? input.recommended_actions.map((a) => `- ${a}`).join('\n') : '(continuing current cadence)'}

Respond with strict JSON: {"executive_summary": "<4 sentences>", "key_points": ["<bullet>", "<bullet>", ...]}.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  let raw = ''
  for (const block of response.content) {
    if (block.type === 'text') {
      raw = block.text.trim()
      break
    }
  }

  try {
    const parsed = JSON.parse(stripCodeFence(raw)) as {
      executive_summary?: unknown
      key_points?: unknown
    }
    const exec = typeof parsed.executive_summary === 'string' ? parsed.executive_summary.trim() : ''
    const points = Array.isArray(parsed.key_points)
      ? parsed.key_points.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
      : []
    return { executive_summary: exec, key_points: points }
  } catch {
    // Fallback: give callers the raw text as the summary; no key points.
    return { executive_summary: raw, key_points: [] }
  }
}

// Defensive — the system prompt forbids code fences but a stray ```json may
// still slip through on rare runs. Strip it rather than fail the row.
function stripCodeFence(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : s
}
