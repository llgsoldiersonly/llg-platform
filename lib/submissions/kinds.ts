// Submission kinds: free-text discriminator in DB, constrained in app code.
// Used by the staff submission form to populate the kind dropdown.
//
// All kinds auto-approve on insert via DB trigger (see migration 0021).
// The `lifecycle` tag drives UI grouping (pre-launch checklist vs post-
// launch monthly production) and doesn't gate anything.

export const SUBMISSION_KINDS = [
  // Recurring (post-launch) — one submission = one count toward monthly deliverable
  { value: 'blog', label: 'Blog post', lifecycle: 'post_launch' },
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
