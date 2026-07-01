// Submission kinds: free-text discriminator in DB, constrained in app code.
// Used by the staff submission form to populate the kind dropdown.
//
// All kinds auto-approve on insert via DB trigger (see migration 0021).
// The `lifecycle` tag drives UI grouping (pre-launch checklist vs post-
// launch monthly production) and doesn't gate anything.

export const SUBMISSION_KINDS = [
  // Recurring (post-launch) — one submission = one count toward monthly deliverable
  { value: 'blog', label: 'Blog post', lifecycle: 'post_launch' },
  { value: 'video', label: 'Video', lifecycle: 'post_launch' },
  { value: 'faq', label: 'FAQ page', lifecycle: 'post_launch' },
  { value: 'ai_page', label: 'AI page', lifecycle: 'post_launch' },
  { value: 'gmb_post', label: 'GMB post', lifecycle: 'post_launch' },
  { value: 'social_post', label: 'Social post', lifecycle: 'post_launch' },
  { value: 'citation', label: 'Citation', lifecycle: 'post_launch' },
  { value: 'link', label: 'Backlink', lifecycle: 'post_launch' },

  // One-time (pre-launch) — single submission marks the deliverable done
  { value: 'parent_page', label: 'Parent page', lifecycle: 'pre_launch' },
  { value: 'child_page', label: 'Child page', lifecycle: 'pre_launch' },
  { value: 'design_theme', label: 'Design theme', lifecycle: 'pre_launch' },
  { value: 'gmb_build', label: 'GMB build', lifecycle: 'pre_launch' },
  { value: 'directory', label: 'Directory listing', lifecycle: 'pre_launch' },
  { value: 'social_channel', label: 'Social channel setup', lifecycle: 'pre_launch' },
] as const

export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]['value']

export function getSubmissionKind(value: string) {
  return SUBMISSION_KINDS.find((k) => k.value === value)
}

export function isValidSubmissionKind(value: string): value is SubmissionKind {
  return SUBMISSION_KINDS.some((k) => k.value === value)
}

// Per submission kind, which package_deliverables.code patterns are relevant.
// Used by the "Counts toward" dropdown on the submission forms to narrow
// the deliverable list to what actually makes sense for the work being
// logged (e.g. picking 'Blog post' as Kind only shows BLOG_* deliverables).
//
// A predicate-based shape (rather than a flat allowlist of codes) keeps
// future additions cheap — when a new code like 'BLOG_QUARTERLY' appears,
// it matches `code.startsWith('BLOG_')` automatically.
const KIND_TO_CODE_PREDICATE: Record<SubmissionKind, (code: string) => boolean> = {
  blog:           (c) => c.startsWith('BLOG_') || c === 'BLOG_IMG_OPT',
  video:          (c) => c.startsWith('VIDEO_'),
  faq:            (c) => c.includes('FAQ'),
  ai_page:        (c) => c.startsWith('AI_') || c.includes('GEO_AI') || c.includes('VOICE_SEARCH'),
  gmb_post:       (c) => c === 'GMB_POSTS' || c === 'GMB_VIDEO',
  social_post:    (c) => c.startsWith('SOCIAL_'),
  citation:       (c) => c.startsWith('NAP_') || c.includes('CITATION') || c === 'YAHOO_BING',
  link:           (c) => c === 'LINK_BUILDING' || c === 'PRESS_RELEASE',
  parent_page:    (c) => c === 'PARENT_SEO_PAGES',
  child_page:     (c) => c === 'CHILD_SEO_PAGES' || c === 'INNER_PAGES',
  design_theme:   (c) => c === 'HOMEPAGE_OPT' || c === 'TECHNICAL_SEO' || c === 'CDN_HOSTING',
  gmb_build:      (c) => c === 'GMB_OPTIMIZATION' || c === 'GMB_PRACTICE_AREAS',
  directory:      (c) => c.startsWith('NAP_') || c === 'YAHOO_BING',
  social_channel: (c) => c === 'SOCIAL_LINKING',
}

// Best-guess submission kind for a deliverable's template code. Used by
// inline deliverable proof, where staff attach a URL straight to a
// deliverable card without picking a kind — we infer it from the code.
// Falls back to 'link' for custom / unmatched deliverables (any http(s)
// URL is still a valid proof; 'link' just files it under Backlink).
export function deriveKindFromCode(code: string | null | undefined): SubmissionKind {
  if (!code) return 'link'
  for (const k of SUBMISSION_KINDS) {
    const pred = KIND_TO_CODE_PREDICATE[k.value]
    if (pred && pred(code)) return k.value
  }
  return 'link'
}

// Returns true if a deliverable with this code is a plausible match for
// the submission kind. Empty / null codes (custom deliverables that aren't
// template-backed) always pass through — staff may legitimately want to
// attach work to a custom one-off deliverable.
export function kindMatchesDeliverableCode(
  kind: SubmissionKind,
  code: string | null | undefined
): boolean {
  if (!code) return true
  const pred = KIND_TO_CODE_PREDICATE[kind]
  return pred ? pred(code) : true
}
