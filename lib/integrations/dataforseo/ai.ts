// DataForSEO AI Optimization — LLM Responses wrappers.
//
// We call DataForSEO's `llm_responses/live` endpoints, which actually submit
// a custom prompt to a hosted LLM (ChatGPT, Gemini, Perplexity) and return
// the live response plus its citations. The older `llm_mentions/search/live`
// endpoint is a different product — it searches a historical corpus of AI
// responses and is NOT what we want here.
//
// Detection logic:
//   - "mentioned" = firm name appears anywhere in the response text
//   - "cited"     = the firm's primary domain appears in any annotation URL

import { dataForSeoPost, getFirstResult } from './client'
import { isSameOrSubdomain, normalizeDomain } from './normalize'

type CallOpts = { client_id?: string | null }

export type LlmPlatform = 'chat_gpt' | 'gemini' | 'perplexity'

export type LlmResponseInput = {
  prompt: string
  targetDomain: string
  firmName: string
  platform: LlmPlatform
  // Optional geo signals for web-search-grounded responses.
  webSearchCountryIsoCode?: string  // e.g. 'US'
  webSearchCity?: string
  // Override the default model. Pass the basic name and DFS picks the latest
  // version automatically (per their docs).
  modelName?: string
}

export type LlmResponseResult = {
  raw: unknown
  response_text: string
  citation_urls: string[]
  // Did the firm's name appear in the text body of the response?
  client_mentioned: boolean
  client_mention_count: number
  // Did the firm's domain appear in any citation URL?
  client_cited: boolean
  client_citation_urls: string[]
  // Other domains cited in the same response — feeds competitor_mentions
  // and top_domains downstream.
  competitor_mentions: Array<{ domain: string; mention_count: number }>
  top_domains: Array<{ domain: string; mention_count: number }>
}

// Default model per platform. Picked cheap/fast variants. If DFS rejects,
// the error response lists valid model names and we can adjust.
const DEFAULT_MODELS: Record<LlmPlatform, string> = {
  chat_gpt: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  perplexity: 'sonar',
}

const ENDPOINT_PATHS: Record<LlmPlatform, string> = {
  chat_gpt: '/ai_optimization/chat_gpt/llm_responses/live',
  gemini: '/ai_optimization/gemini/llm_responses/live',
  perplexity: '/ai_optimization/perplexity/llm_responses/live',
}

export async function getLlmResponse(
  input: LlmResponseInput,
  opts: CallOpts = {}
): Promise<LlmResponseResult> {
  const modelName = input.modelName ?? DEFAULT_MODELS[input.platform]
  const tag = `llm-resp:${input.platform}:${input.targetDomain}:${input.prompt.slice(0, 40)}`

  const task: Record<string, unknown> = {
    user_prompt: input.prompt.slice(0, 500), // DFS caps prompts at 500 chars
    model_name: modelName,
    web_search: true,
    force_web_search: true,
    tag,
  }
  if (input.webSearchCountryIsoCode) task.web_search_country_iso_code = input.webSearchCountryIsoCode
  if (input.webSearchCity) task.web_search_city = input.webSearchCity

  const response = await dataForSeoPost<{
    items?: Array<Record<string, unknown>>
  }>(
    ENDPOINT_PATHS[input.platform],
    task,
    { client_id: opts.client_id, request_tag: tag }
  )

  const result = getFirstResult(response) ?? {}
  const items = ((result as { items?: Array<Record<string, unknown>> }).items ?? []) as Array<
    Record<string, unknown>
  >

  // Collect text + annotations across all items / sections. Modern DFS shape
  // is `items[].message.sections[]` with each section carrying its own
  // annotations; older shapes may put annotations at the item level.
  const textParts: string[] = []
  const annotations: Array<{ title?: string; url?: string }> = []

  for (const item of items) {
    const message = (item.message ?? item) as Record<string, unknown>
    const sections = (message.sections ?? []) as Array<Record<string, unknown>>
    for (const section of sections) {
      const text = typeof section.text === 'string' ? section.text : ''
      if (text) textParts.push(text)
      const sectionAnnotations = (section.annotations ?? []) as Array<{ title?: string; url?: string }>
      annotations.push(...sectionAnnotations)
    }
    // Fallback: some shapes attach annotations at the item level
    const itemAnnotations = (item.annotations ?? []) as Array<{ title?: string; url?: string }>
    annotations.push(...itemAnnotations)
  }

  const responseText = textParts.join('\n\n').trim()
  const citationUrls = Array.from(
    new Set(annotations.map((a) => a.url).filter((u): u is string => typeof u === 'string'))
  )

  // Mention detection — strip all non-alphanumerics from both sides before
  // matching so "Daniels Law PA" in the DB matches "Daniels Law, P.A." in the
  // response. False-positive risk is low for firm names (collisions like
  // "danielslawpa" appearing as a substring of an unrelated string are rare).
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const haystackCompact = compact(responseText)
  const needleCompact = compact(input.firmName)
  let clientMentionCount = 0
  if (needleCompact.length > 0 && haystackCompact.length > 0) {
    let idx = 0
    while ((idx = haystackCompact.indexOf(needleCompact, idx)) !== -1) {
      clientMentionCount += 1
      idx += needleCompact.length
    }
  }
  const clientMentioned = clientMentionCount > 0

  // Citation detection — does any annotation URL resolve to the client's
  // primary domain (or a subdomain)?
  const targetDomain = normalizeDomain(input.targetDomain)
  const clientCitationUrls = citationUrls.filter((url) => isSameOrSubdomain(url, targetDomain))
  const clientCited = clientCitationUrls.length > 0

  // Bucket non-client citations by domain for the competitor_mentions /
  // top_domains fields. Downstream the page can render "also cited:" lists.
  const domainCounts = new Map<string, number>()
  for (const url of citationUrls) {
    if (isSameOrSubdomain(url, targetDomain)) continue
    const domain = normalizeDomain(url)
    if (!domain) continue
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1)
  }
  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, mention_count]) => ({ domain, mention_count }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 20)

  return {
    raw: result,
    response_text: responseText,
    citation_urls: citationUrls,
    client_mentioned: clientMentioned,
    client_mention_count: clientMentionCount,
    client_cited: clientCited,
    client_citation_urls: clientCitationUrls,
    competitor_mentions: [],
    top_domains: topDomains,
  }
}

