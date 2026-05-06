// DataForSEO SERP wrappers — Google Organic Live Advanced + Google AI Mode.
// Maps the API response to our snapshot shape (rank found / top competitors).
// Local Finder + Maps grid live in ./local.ts.

import { dataForSeoPost, getFirstResult } from './client'
import { isSameOrSubdomain, normalizeDomain } from './normalize'

type CallOpts = { client_id?: string | null }

type RankCheckInput = {
  keyword: string
  clientDomain: string
  // Provide one of locationCode (preferred) or locationName.
  locationCode?: number
  locationName?: string
  languageCode?: string
  device?: 'desktop' | 'mobile'
  os?: 'windows' | 'macos' | 'android' | 'ios'
  depth?: number
}

export type RankCheckResult = {
  raw: unknown
  client_rank_group: number | null
  client_rank_absolute: number | null
  client_url: string | null
  client_title: string | null
  client_description: string | null
  is_client_ranking: boolean
  ranking_domain: string | null
  serp_features: { types: string[] } | null
  top_competitors: Array<{
    rank_group: number | null
    rank_absolute: number | null
    domain: string | null
    url: string | null
    title: string | null
  }>
}

export async function getGoogleOrganicRank(
  input: RankCheckInput,
  opts: CallOpts = {}
): Promise<RankCheckResult> {
  const task: Record<string, unknown> = {
    keyword: input.keyword,
    language_code: input.languageCode ?? 'en',
    device: input.device ?? 'desktop',
    depth: input.depth ?? 100,
    tag: `organic-rank:${input.clientDomain}:${input.keyword}`,
  }
  if (input.locationCode) task.location_code = input.locationCode
  else if (input.locationName) task.location_name = input.locationName
  if (input.os) task.os = input.os

  const response = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/serp/google/organic/live/advanced',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )

  const result = getFirstResult(response)
  const items = (result?.items ?? []) as Array<Record<string, unknown>>
  const organicItems = items.filter((i) => i.type === 'organic')

  const client = organicItems.find((i) =>
    isSameOrSubdomain(String(i.domain ?? i.url ?? ''), input.clientDomain)
  )

  // serp_features: distinct non-organic item types in the page (featured snippet,
  // ai_overview, knowledge_graph, etc.). Stored as an array for downstream UI.
  const featureTypes = Array.from(
    new Set(items.map((i) => String(i.type ?? '')).filter((t) => t && t !== 'organic'))
  )

  return {
    raw: result,
    client_rank_group: (client?.rank_group as number | undefined) ?? null,
    client_rank_absolute: (client?.rank_absolute as number | undefined) ?? null,
    client_url: (client?.url as string | undefined) ?? null,
    client_title: (client?.title as string | undefined) ?? null,
    client_description: (client?.description as string | undefined) ?? null,
    is_client_ranking: !!client,
    ranking_domain: client ? normalizeDomain(String(client.domain ?? client.url ?? '')) : null,
    serp_features: featureTypes.length ? { types: featureTypes } : null,
    top_competitors: organicItems.slice(0, 10).map((i) => ({
      rank_group: (i.rank_group as number | undefined) ?? null,
      rank_absolute: (i.rank_absolute as number | undefined) ?? null,
      domain: (i.domain as string | undefined) ?? null,
      url: (i.url as string | undefined) ?? null,
      title: (i.title as string | undefined) ?? null,
    })),
  }
}

// ---------------------------------------------------------------
// Google AI Mode — extracts whether the client is cited in the AI
// overview / AI mode panel. Lives here (not ai.ts) because it's a
// SERP-family endpoint, not the LLM Mentions API.
// ---------------------------------------------------------------
type AiModeInput = {
  keyword: string
  clientDomain: string
  locationCode?: number
  locationName?: string
  languageCode?: string
  device?: 'desktop' | 'mobile'
}

export type AiModeResult = {
  raw: unknown
  client_cited: boolean
  client_citation_urls: string[]
  all_references: Array<{ url: string | null; title: string | null; domain: string | null }>
}

export async function getGoogleAiModeVisibility(
  input: AiModeInput,
  opts: CallOpts = {}
): Promise<AiModeResult> {
  const task: Record<string, unknown> = {
    keyword: input.keyword,
    language_code: input.languageCode ?? 'en',
    device: input.device ?? 'desktop',
    tag: `google-ai-mode:${input.clientDomain}:${input.keyword}`,
  }
  if (input.locationCode) task.location_code = input.locationCode
  else if (input.locationName) task.location_name = input.locationName

  const response = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/serp/google/ai_mode/live/advanced',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )

  const result = getFirstResult(response)
  const references = extractAiReferences(result)
  const clientRefs = references.filter((r) =>
    r.url ? isSameOrSubdomain(r.url, input.clientDomain) : false
  )

  return {
    raw: result,
    client_cited: clientRefs.length > 0,
    client_citation_urls: clientRefs.map((r) => r.url).filter(Boolean) as string[],
    all_references: references,
  }
}

function extractAiReferences(
  result: unknown
): Array<{ url: string | null; title: string | null; domain: string | null }> {
  const items = ((result as { items?: Array<Record<string, unknown>> })?.items ?? []) as Array<
    Record<string, unknown>
  >
  const refs: Array<{ url: string | null; title: string | null; domain: string | null }> = []

  for (const item of items) {
    const type = String(item.type ?? '')
    if (!type.includes('ai_overview') && type !== 'ai_mode') continue

    if (Array.isArray(item.links)) {
      for (const link of item.links as Array<Record<string, unknown>>) {
        refs.push({
          url: (link.url as string | undefined) ?? null,
          title: (link.title as string | undefined) ?? null,
          domain: (link.domain as string | undefined) ?? null,
        })
      }
    }
    if (Array.isArray(item.references)) {
      for (const link of item.references as Array<Record<string, unknown>>) {
        refs.push({
          url: (link.url as string | undefined) ?? null,
          title: (link.title as string | undefined) ?? null,
          domain: (link.domain as string | undefined) ?? null,
        })
      }
    }
    if (Array.isArray(item.components)) {
      for (const comp of item.components as Array<Record<string, unknown>>) {
        if (Array.isArray(comp.links)) {
          for (const link of comp.links as Array<Record<string, unknown>>) {
            refs.push({
              url: (link.url as string | undefined) ?? null,
              title: (link.title as string | undefined) ?? null,
              domain: (link.domain as string | undefined) ?? null,
            })
          }
        }
      }
    }
  }
  return refs
}
