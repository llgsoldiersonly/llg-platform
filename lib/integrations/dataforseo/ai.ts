// DataForSEO AI Optimization wrappers — LLM Mentions search.
//
// Note: Google AI Mode (SERP-family endpoint) lives in ./serp.ts as
// getGoogleAiModeVisibility. This file is for the dedicated AI Optimization
// product (LLM Mentions API) — distinct billing family that requires its
// own activation in the DataForSEO subscriptions page.

import { dataForSeoPost, getFirstResult } from './client'
import { isSameOrSubdomain } from './normalize'

type CallOpts = { client_id?: string | null }

type LlmMentionsInput = {
  // The domain we want to know if LLMs are mentioning/citing.
  targetDomain: string
  // Prompt or topic the user would ask the LLM.
  keyword: string
  platform?: 'google' | 'chat_gpt'
  locationCode?: number
  locationName?: string
  languageCode?: string
}

export type LlmMentionsResult = {
  raw: unknown
  client_mentioned: boolean
  client_cited: boolean
  client_mention_count: number
  client_citation_urls: string[]
  competitor_mentions: Array<{ domain: string; mention_count: number }>
  top_domains: Array<{ domain: string; mention_count: number }>
}

export async function getLlmMentions(
  input: LlmMentionsInput,
  opts: CallOpts = {}
): Promise<LlmMentionsResult> {
  // DataForSEO LLM Mentions accepts `target` as an array of domains we want
  // to detect mentions/citations of (we only ever check one — the client's
  // primary_domain). Was a single string in earlier API versions; now must
  // be an array or DFS returns "expected array" 400.
  const task: Record<string, unknown> = {
    target: [input.targetDomain],
    keyword: input.keyword,
    platform: input.platform ?? 'google',
    language_code: input.languageCode ?? 'en',
    tag: `llm-mentions:${input.targetDomain}:${input.keyword}`,
  }
  if (input.locationCode) task.location_code = input.locationCode
  else if (input.locationName) task.location_name = input.locationName

  const response = await dataForSeoPost<{
    items?: Array<Record<string, unknown>>
    summary?: Record<string, unknown>
  }>(
    '/ai_optimization/llm_mentions/search/live',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )

  const result = getFirstResult(response) ?? {}
  const items = ((result as { items?: Array<Record<string, unknown>> }).items ?? []) as Array<
    Record<string, unknown>
  >

  // The shape of LLM Mentions results varies — handle both
  // (a) per-prompt items with citation arrays and
  // (b) aggregate summary blocks.
  let mentionCount = 0
  const citationUrls: string[] = []
  const domainCounts = new Map<string, number>()

  for (const item of items) {
    const links = (item.links ?? item.citations ?? item.references) as
      | Array<Record<string, unknown>>
      | undefined
    if (!Array.isArray(links)) continue

    for (const link of links) {
      const url = String(link.url ?? '')
      const domain = String(link.domain ?? '')
      if (!url && !domain) continue

      // Count toward client if matches; otherwise toward domain map.
      if (url && isSameOrSubdomain(url, input.targetDomain)) {
        mentionCount += 1
        citationUrls.push(url)
      } else if (domain) {
        const key = domain.toLowerCase()
        domainCounts.set(key, (domainCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, mention_count]) => ({ domain, mention_count }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 20)

  return {
    raw: result,
    client_mentioned: mentionCount > 0,
    client_cited: citationUrls.length > 0,
    client_mention_count: mentionCount,
    client_citation_urls: citationUrls,
    // Without a per-client competitor list we can't split competitors from
    // top-domains here. Phase C builds the join when admin defines competitors.
    competitor_mentions: [],
    top_domains: topDomains,
  }
}
