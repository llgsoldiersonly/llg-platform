// Generates the prompts used in the monthly AI visibility sweep.
//
// Strategy: pull each firm's top tracked_keywords (priority=high or medium),
// then expand each keyword into 2 natural-language prompts that mimic how
// a prospect would actually phrase the query to an AI assistant. The point
// is to catch mentions where the prospect didn't search a website directly
// — they asked an AI and accepted its recommendation.
//
// Cost discipline: we cap at 4 keywords × 2 prompts × 2 platforms = 16
// calls/firm/month. Bumping this is easy when needed but ROI flattens fast.

export type TrackedKeywordForPrompt = {
  id: string
  keyword: string
  city: string | null
  state: string | null
  practice_area: string | null
}

export type GeneratedPrompt = {
  tracked_keyword_id: string
  prompt: string
}

const MAX_KEYWORDS_PER_FIRM = 4

export function generatePromptsForFirm(
  keywords: TrackedKeywordForPrompt[]
): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = []
  const selected = keywords.slice(0, MAX_KEYWORDS_PER_FIRM)

  for (const kw of selected) {
    const location = locationPhrase(kw.city, kw.state)
    const subject = (kw.practice_area || kw.keyword).trim()

    // Prompt A — recommendation framing ("best in X")
    out.push({
      tracked_keyword_id: kw.id,
      prompt: location
        ? `Who's the best ${subject} in ${location}?`
        : `Who's the best ${subject}?`,
    })

    // Prompt B — action framing ("who should I call after Y")
    out.push({
      tracked_keyword_id: kw.id,
      prompt: location
        ? `Who should I hire for ${subject} in ${location}?`
        : `Who should I hire for ${subject}?`,
    })
  }

  return out
}

function locationPhrase(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return null
}
