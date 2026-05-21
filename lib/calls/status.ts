// Maps CallRail tags into the three client-facing funnel buckets the
// /overview Calls widget exposes. Per Nathan, 2026-05-21:
//
//   accepted  ← "conversion"
//   rejected  ← "abandoned" | "other" | "existing customer"
//   pending   ← "qualified"
//
// A call can carry multiple tags. Priority is "highest-commitment wins":
// conversion beats everything (a closed deal stays accepted even if it
// was also tagged qualified earlier); then rejected (terminal won't-
// convert); then pending. Untagged or unrecognized-tag calls return
// 'unknown' and don't surface in any of the three tabs.

export type CallStatus = 'accepted' | 'rejected' | 'pending' | 'unknown'

const ACCEPTED_TAGS = new Set(['conversion'])
const REJECTED_TAGS = new Set(['abandoned', 'other', 'existing customer'])
const PENDING_TAGS = new Set(['qualified'])

export function deriveStatusFromTags(tags: string[] | null | undefined): CallStatus {
  if (!tags || tags.length === 0) return 'unknown'
  const lc = tags.map((t) => t.toLowerCase().trim())
  if (lc.some((t) => ACCEPTED_TAGS.has(t))) return 'accepted'
  if (lc.some((t) => REJECTED_TAGS.has(t))) return 'rejected'
  if (lc.some((t) => PENDING_TAGS.has(t))) return 'pending'
  return 'unknown'
}

// Primary tag for display — picks the one that drove the status decision,
// falling back to whatever's first when the status is 'unknown'.
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
