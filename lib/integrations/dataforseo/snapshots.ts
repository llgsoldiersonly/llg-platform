// Snapshot writers — persist DataForSEO API results into dfs_* tables.
// Cron jobs and the manual-refresh endpoint compose these.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RankCheckResult } from './serp'
import type { LocalRankResult } from './local'
import type { LlmMentionsResult } from './ai'

type Supa = SupabaseClient

// ---------------------------------------------------------------
// Date helpers — month_key is the YYYY-MM partition we group on.
// ---------------------------------------------------------------
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}
export function todayMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
export function monthBounds(date = new Date()): { monthStart: string; nextMonthStart: string } {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1))
  const next = new Date(Date.UTC(y, m + 1, 1))
  return {
    monthStart: start.toISOString().slice(0, 10),
    nextMonthStart: next.toISOString().slice(0, 10),
  }
}

// ---------------------------------------------------------------
// Backlink summary + month-to-date counts → dfs_backlink_snapshots
// ---------------------------------------------------------------
export async function saveBacklinkSummarySnapshot(
  supa: Supa,
  args: {
    clientId: string
    summary: unknown
    mtdCounts: unknown
  }
) {
  const s = (args.summary ?? {}) as Record<string, unknown>
  const m = (args.mtdCounts ?? {}) as Record<string, unknown>
  const row = {
    client_id: args.clientId,
    snapshot_date: todayDate(),
    month_key: todayMonthKey(),
    total_backlinks: numberOr0(s.backlinks),
    referring_domains: numberOr0(s.referring_domains),
    referring_main_domains: numberOr0(s.referring_main_domains),
    referring_ips: numberOr0(s.referring_ips),
    broken_backlinks: numberOr0(s.broken_backlinks),
    backlink_spam_score: numberOr0(s.backlinks_spam_score),
    new_backlinks: numberOr0(m.new_backlinks),
    lost_backlinks: numberOr0(m.lost_backlinks),
    new_referring_domains: numberOr0(m.new_referring_domains),
    lost_referring_domains: numberOr0(m.lost_referring_domains),
    raw_summary: args.summary,
    raw_new_lost: args.mtdCounts,
  }
  const { error } = await supa
    .from('dfs_backlink_snapshots')
    .upsert(row, { onConflict: 'client_id,snapshot_date' })
  if (error) throw new Error(`dfs_backlink_snapshots upsert: ${error.message}`)
}

// ---------------------------------------------------------------
// Backlink rows (new/lost) → dfs_backlink_rows
// ---------------------------------------------------------------
export async function saveBacklinkRows(
  supa: Supa,
  args: {
    clientId: string
    monthKey: string
    status: 'new' | 'lost' | 'live'
    items: Array<Record<string, unknown>>
  }
) {
  if (!args.items.length) return
  const rows = args.items.map((b) => ({
    client_id: args.clientId,
    month_key: args.monthKey,
    status: args.status,
    domain_from: stringOrNull(b.domain_from),
    url_from: stringOrNull(b.url_from),
    url_to: stringOrNull(b.url_to),
    page_from_title: stringOrNull(b.page_from_title),
    first_seen: stringOrNull(b.first_seen),
    prev_seen: stringOrNull(b.prev_seen),
    last_seen: stringOrNull(b.last_seen),
    dofollow: boolOrNull(b.dofollow),
    anchor: stringOrNull(b.anchor),
    item_type: stringOrNull(b.item_type),
    semantic_location: stringOrNull(b.semantic_location),
    is_broken: boolOrNull(b.is_broken),
    backlink_spam_score: numberOrNull(b.backlink_spam_score),
    rank: numberOrNull(b.rank),
    page_from_rank: numberOrNull(b.page_from_rank),
    domain_from_rank: numberOrNull(b.domain_from_rank),
    domain_from_country: stringOrNull(b.domain_from_country),
    insight_category: classifyBacklink(b),
    raw: b,
  }))
  const { error } = await supa
    .from('dfs_backlink_rows')
    .upsert(rows, { onConflict: 'client_id,status,url_from,url_to,month_key' })
  if (error) throw new Error(`dfs_backlink_rows upsert: ${error.message}`)
}

// ---------------------------------------------------------------
// SERP rank check → dfs_keyword_rank_snapshots
// ---------------------------------------------------------------
export async function saveKeywordRankSnapshot(
  supa: Supa,
  args: {
    trackedKeywordId: string
    clientId: string
    keyword: string
    searchType: string
    device: string | null
    locationName: string | null
    result: RankCheckResult
  }
) {
  const { result } = args
  const row = {
    tracked_keyword_id: args.trackedKeywordId,
    client_id: args.clientId,
    snapshot_date: todayDate(),
    month_key: todayMonthKey(),
    keyword: args.keyword,
    search_type: args.searchType,
    device: args.device,
    location_name: args.locationName,
    rank_group: result.client_rank_group,
    rank_absolute: result.client_rank_absolute,
    url: result.client_url,
    title: result.client_title,
    description: result.client_description,
    is_client_ranking: result.is_client_ranking,
    ranking_domain: result.ranking_domain,
    serp_features: result.serp_features,
    top_competitors: result.top_competitors,
    raw: result.raw,
  }
  const { error } = await supa
    .from('dfs_keyword_rank_snapshots')
    .upsert(row, { onConflict: 'tracked_keyword_id,snapshot_date,search_type,device' })
  if (error) throw new Error(`dfs_keyword_rank_snapshots upsert: ${error.message}`)
}

// ---------------------------------------------------------------
// Map grid rank → dfs_map_grid_rank_snapshots
// ---------------------------------------------------------------
export async function saveMapGridRankSnapshot(
  supa: Supa,
  args: {
    mapGridPointId: string
    trackedKeywordId: string
    clientId: string
    keyword: string
    lat: number
    lng: number
    result: LocalRankResult
  }
) {
  const { result } = args
  const row = {
    map_grid_point_id: args.mapGridPointId,
    tracked_keyword_id: args.trackedKeywordId,
    client_id: args.clientId,
    snapshot_date: todayDate(),
    month_key: todayMonthKey(),
    keyword: args.keyword,
    lat: args.lat,
    lng: args.lng,
    client_map_rank: result.client_rank_absolute,
    client_found: result.client_found,
    top_results: result.top_results,
    raw: result.raw,
  }
  const { error } = await supa
    .from('dfs_map_grid_rank_snapshots')
    .upsert(row, { onConflict: 'map_grid_point_id,tracked_keyword_id,snapshot_date' })
  if (error) throw new Error(`dfs_map_grid_rank_snapshots upsert: ${error.message}`)
}

// ---------------------------------------------------------------
// AI / LLM mentions → dfs_ai_visibility_snapshots
// ---------------------------------------------------------------
export async function saveAiVisibilitySnapshot(
  supa: Supa,
  args: {
    clientId: string
    trackedKeywordId: string | null
    platform: string
    prompt: string
    result: LlmMentionsResult | { client_cited: boolean; client_citation_urls: string[]; raw: unknown }
  }
) {
  const r = args.result as LlmMentionsResult
  const row = {
    client_id: args.clientId,
    tracked_keyword_id: args.trackedKeywordId,
    snapshot_date: todayDate(),
    month_key: todayMonthKey(),
    platform: args.platform,
    prompt: args.prompt,
    client_mentioned: r.client_mentioned ?? r.client_cited ?? false,
    client_cited: r.client_cited ?? false,
    client_mention_count: r.client_mention_count ?? (r.client_cited ? 1 : 0),
    client_citation_urls: r.client_citation_urls ?? [],
    competitor_mentions: r.competitor_mentions ?? [],
    top_domains: r.top_domains ?? [],
    raw: r.raw,
  }
  const { error } = await supa.from('dfs_ai_visibility_snapshots').insert(row)
  if (error) throw new Error(`dfs_ai_visibility_snapshots insert: ${error.message}`)
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function numberOr0(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}
function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null
}
function boolOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

// Heuristic classifier so the dashboard can sort "high value" lost links to
// the top. Conservative — only label things we're confident about.
function classifyBacklink(b: Record<string, unknown>): string {
  const spam = numberOrNull(b.backlink_spam_score) ?? 0
  const dofollow = b.dofollow === true
  const domainRank = numberOrNull(b.domain_from_rank) ?? 0
  const itemType = String(b.item_type ?? '').toLowerCase()

  if (spam >= 50) return 'spam'
  if (itemType === 'redirect') return 'redirect'
  if (dofollow && domainRank >= 60) return 'high_value'
  if (dofollow && domainRank >= 30) return 'medium_value'
  if (!dofollow) return 'nofollow'
  return 'low_value'
}
