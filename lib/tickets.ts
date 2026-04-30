// Human-readable label helpers for ticket fields. The DB stores short codes
// ('bug', 'seo', 'medium', 'open'); the UI should render them as full
// phrases so a single badge isn't ambiguous on its own.

export type TicketType = 'bug' | 'request'
export type TicketCategory =
  | 'seo' | 'design' | 'dev' | 'ads' | 'content' | 'intakes' | 'billing' | 'other'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus =
  | 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed'

export function formatTicketType(t: string | null | undefined): string {
  switch (t) {
    case 'bug':     return 'Bug'
    case 'request': return 'Request'
    default:        return t ?? '—'
  }
}

export function formatTicketCategory(c: string | null | undefined): string {
  switch (c) {
    case 'seo':     return 'SEO'
    case 'design':  return 'Design'
    case 'dev':     return 'Development'
    case 'ads':     return 'Paid Ads'
    case 'content': return 'Content'
    case 'intakes': return 'Intakes'
    case 'billing': return 'Billing'
    case 'other':   return 'Other'
    default:        return c ?? 'Other'
  }
}

export function formatTicketPriority(p: string | null | undefined): string {
  switch (p) {
    case 'low':    return 'Low priority'
    case 'medium': return 'Medium priority'
    case 'high':   return 'High priority'
    case 'urgent': return 'Urgent'
    default:       return p ?? '—'
  }
}

export function formatTicketStatus(s: string | null | undefined): string {
  switch (s) {
    case 'open':              return 'Open'
    case 'in_progress':       return 'In progress'
    case 'waiting_on_client': return 'Waiting on you'
    case 'resolved':          return 'Resolved'
    case 'closed':            return 'Closed'
    default:                  return s ?? '—'
  }
}
