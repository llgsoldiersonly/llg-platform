// Generates the AI-surface prompts for the monthly AI visibility sweep.
//
// Approach:
//  - Take the sourced keywords (already ordered by likelihood of mention)
//  - For each, strip the city/state out of the keyword itself if present.
//    Tracked keywords come from SEO targeting and often have city baked in
//    ("divorce lawyer fort myers") — appending " in Fort Myers, FL" produces
//    awkward "divorce lawyer fort myers in Fort Myers, FL" prompts.
//  - Expand each cleaned subject into N natural-language framings that mirror
//    how real prospects would actually ask an AI.

export type SourcedKeywordForPrompt = {
  tracked_keyword_id: string
  keyword: string
  city: string | null
  state: string | null
}

export type GeneratedPrompt = {
  tracked_keyword_id: string
  prompt: string
}

// Three natural framings per keyword. Different verbs and structures mean
// more SERP-style + chat-style + recommendation-style coverage, which
// increases the chance the AI surfaces a real firm name vs a generic
// "I can't recommend specific lawyers" response.
const FRAMINGS: Array<(subject: string, loc: string | null) => string> = [
  (s, l) => (l ? `Who's the best ${s} in ${l}?` : `Who's the best ${s}?`),
  (s, l) => (l ? `Recommend a ${s} near me in ${l}.` : `Recommend a ${s} near me.`),
  (s, l) => (l ? `I need a ${s} in ${l}. Who's good?` : `I need a ${s}. Who's good?`),
]

export function generatePromptsForFirm(
  keywords: SourcedKeywordForPrompt[]
): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = []

  for (const kw of keywords) {
    const subject = cleanSubject(kw)
    if (!subject) continue
    const location = locationPhrase(kw.city, kw.state)

    for (const framing of FRAMINGS) {
      out.push({
        tracked_keyword_id: kw.tracked_keyword_id,
        prompt: framing(subject, location),
      })
    }
  }

  return out
}

// Strips city/state from the keyword so prompts read naturally when we
// append the canonical location. Falls back to the raw keyword if stripping
// would leave nothing meaningful.
function cleanSubject(kw: SourcedKeywordForPrompt): string {
  let s = kw.keyword.trim()
  if (!s) return ''

  for (const token of [kw.city, kw.state]) {
    if (!token) continue
    // Whole-word, case-insensitive removal. Handles "fort myers" and "fl"
    // appearing anywhere in the string.
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi')
    s = s.replace(re, ' ')
  }

  // Drop standalone state abbreviations if state was set (some keywords
  // include both "fort myers fl" and the state code was already removed
  // above — but a lone "fl" in different position should also go).
  if (kw.state && kw.state.length === 2) {
    s = s.replace(new RegExp(`\\b${escapeRegExp(kw.state)}\\b`, 'gi'), ' ')
  }

  // Collapse whitespace + trim trailing punctuation
  s = s.replace(/\s+/g, ' ').trim().replace(/[,.\s]+$/, '').trim()

  // If stripping nuked everything, fall back to raw keyword
  return s.length > 0 ? s : kw.keyword.trim()
}

function locationPhrase(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
