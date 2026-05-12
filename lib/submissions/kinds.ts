// Submission kinds: free-text discriminator in DB, but constrained in app code.
// Used by the staff submission form and approval queue.
//
// IMPORTANT: 'social_post' is auto-approved by the DB trigger in 0018 because
// the post is already live on the social platform — submission is reporting only.

export const SUBMISSION_KINDS = [
  // Recurring (post-launch) — one submission = one count toward monthly deliverable
  { value: 'blog', label: 'Blog post', requiresApproval: true, lifecycle: 'post_launch' },
  { value: 'faq', label: 'FAQ page', requiresApproval: true, lifecycle: 'post_launch' },
  { value: 'ai_page', label: 'AI page', requiresApproval: true, lifecycle: 'post_launch' },
  { value: 'gmb_post', label: 'GMB post', requiresApproval: true, lifecycle: 'post_launch' },
  { value: 'social_post', label: 'Social post', requiresApproval: false, lifecycle: 'post_launch' },
  { value: 'citation', label: 'Citation', requiresApproval: true, lifecycle: 'post_launch' },
  { value: 'link', label: 'Backlink', requiresApproval: true, lifecycle: 'post_launch' },

  // One-time (pre-launch) — single submission marks the deliverable done
  { value: 'parent_page', label: 'Parent page', requiresApproval: true, lifecycle: 'pre_launch' },
  { value: 'child_page', label: 'Child page', requiresApproval: true, lifecycle: 'pre_launch' },
  { value: 'design_theme', label: 'Design theme', requiresApproval: true, lifecycle: 'pre_launch' },
  { value: 'gmb_build', label: 'GMB build', requiresApproval: true, lifecycle: 'pre_launch' },
  { value: 'directory', label: 'Directory listing', requiresApproval: true, lifecycle: 'pre_launch' },
  { value: 'social_channel', label: 'Social channel setup', requiresApproval: true, lifecycle: 'pre_launch' },
] as const

export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]['value']

export function getSubmissionKind(value: string) {
  return SUBMISSION_KINDS.find((k) => k.value === value)
}

export function isValidSubmissionKind(value: string): value is SubmissionKind {
  return SUBMISSION_KINDS.some((k) => k.value === value)
}
