// Maps CallRail tags into the four buckets the /overview Calls widget uses.
// Per Nathan, 2026-05-21 (tightened — Pending now only counts a confirmed
// appointment, not mere intent or qualification):
//
//   accepted ← "conversion"
//   pending  ← "schedule booked"
//   rejected ← "abandoned" | "other" | "existing customer" | "unsupported case type"
//            | "out of practice area" | "no answer" | "hung up" | "wrong number"
//   filtered ← "test" | "spam"   — calls excluded from the widget entirely
//
// Tags like "opportunity", "schedule requested", and "qualified" fall to
// 'unknown' on purpose — they're intentionally not surfaced in any tab.
//
// Priority when a call has multiple tags (highest wins):
//   1. filtered   (test/spam) — removes the call from the widget regardless of other tags
//   2. accepted   (conversion is the strongest funnel commitment)
//   3. rejected   (terminal "won't convert" states)
//   4. pending    (confirmed appointment)
//   5. unknown    (call has tags but none are mapped)

export type CallStatus = 'accepted' | 'rejected' | 'pending' | 'unknown' | 'filtered'

const FILTERED_TAGS = new Set(['test', 'spam'])
const ACCEPTED_TAGS = new Set(['conversion'])
const REJECTED_TAGS = new Set([
  'abandoned',
  'other',
  'existing customer',
  'unsupported case type',
  'out of practice area',
  'no answer',
  'hung up',
  'wrong number',
])
const PENDING_TAGS = new Set([
  'schedule booked',
])

export function deriveStatusFromTags(tags: string[] | null | undefined): CallStatus {
  if (!tags || tags.length === 0) return 'unknown'
  const lc = tags.map((t) => t.toLowerCase().trim())
  if (lc.some((t) => FILTERED_TAGS.has(t))) return 'filtered'
  if (lc.some((t) => ACCEPTED_TAGS.has(t))) return 'accepted'
  if (lc.some((t) => REJECTED_TAGS.has(t))) return 'rejected'
  if (lc.some((t) => PENDING_TAGS.has(t))) return 'pending'
  return 'unknown'
}

// Primary tag for display — picks the one that drove the status decision,
// falling back to the first tag when nothing matched.
export function primaryTag(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null
  const lc = tags.map((t) => t.toLowerCase().trim())
  const findMatch = (set: Set<string>) => {
    const idx = lc.findIndex((t) => set.has(t))
    return idx === -1 ? null : tags[idx]
  }
  return (
    findMatch(ACCEPTED_TAGS) ??
    findMatch(REJECTED_TAGS) ??
    findMatch(PENDING_TAGS) ??
    tags[0] ??
    null
  )
}
