import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { getQuotaState } from '@/lib/tickets/quota'
import { formatTicketType, formatTicketStatus } from '@/lib/tickets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupportTeamCard, type TeamMember } from '@/components/client/cards/support-team'
import { Plus, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { TicketsStatusFilter } from './_components/tickets-status-filter'

export const dynamic = 'force-dynamic'

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'secondary' | 'destructive'> = {
  open: 'info',
  in_progress: 'info',
  waiting_on_client: 'warning',
  resolved: 'success',
  closed: 'secondary',
}

type TicketRow = {
  id: string
  ticket_number: number
  type: 'bug' | 'request'
  subject: string
  category: string | null
  priority: string
  status: string
  created_at: string
  sla_deadline_at: string | null
}

const isClosed = (status: string) => status === 'closed' || status === 'resolved'

// Compact relative-time formatter. The reference shows "5 days ago",
// "1 day ago" — keep it terse and English-only for now (matches the
// rest of the portal's copy).
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const yr = Math.round(mo / 12)
  return `${yr} year${yr === 1 ? '' : 's'} ago`
}

export default async function ClientTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const ctx = await getClientContext()
  if (!ctx) redirect('/login')

  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, type, subject, category, priority, status, created_at, sla_deadline_at')
    .eq('client_id', ctx.client.id)
    .order('created_at', { ascending: false })
    .returns<TicketRow[]>()

  const quota = await getQuotaState(supabase, ctx.client.id)

  const list = tickets ?? []
  const openList = list.filter((t) => !isClosed(t.status))
  const closedList = list.filter((t) => isClosed(t.status))
  const counts = { all: list.length, open: openList.length, closed: closedList.length }

  const statusFilter = typeof params.status === 'string' ? params.status : 'all'

  // Per-client team assignment isn't modeled in the schema yet, so we
  // render the LLG default roster here. The names mirror the reference
  // mockup ("Your SEO Lead", "Your Developer", "Your Ads Manager") and
  // are intentionally generic so they read as roles rather than people
  // — clients route tickets to the role and the on-call owner picks
  // them up. Swap to per-client data once the schema lands.
  const team: TeamMember[] = [
    {
      id: 'role-seo',
      role_label: 'SEO Manager',
      full_name: 'Your SEO Lead',
      avatar_color: 'amber',
    },
    {
      id: 'role-dev',
      role_label: 'Web Dev',
      full_name: 'Your Developer',
      avatar_color: 'amber',
    },
    {
      id: 'role-ads',
      role_label: 'Paid Ads',
      full_name: 'Your Ads Manager',
      avatar_color: 'amber',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Support &amp; Tickets</h1>
          <p className="mt-1 text-sm text-body">
            Submit a bug if something&apos;s broken, or a request for new work.
          </p>
        </div>
        <Link href="/tickets/new">
          <Button>
            <Plus className="h-4 w-4" />
            Create New Ticket
          </Button>
        </Link>
      </header>

      {/* Status pills — at-a-glance summary independent of the active
       *  filter, so the user always sees the full inventory counts. */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" className="gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-fg-success-strong" />
          {openList.length} Open
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-neutral-quaternary" />
          {closedList.length} Closed
        </Badge>
        <Badge variant="outline">{list.length} Total</Badge>
      </div>

      <TicketsStatusFilter counts={counts} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column — ticket list. On the All view, split into Open +
         *  Closed sub-sections so closed history stays visible without
         *  forcing the user to switch tabs. Explicit Open/Closed filters
         *  render a flat list (the tab itself is the section header). */}
        <div className="space-y-6 lg:col-span-2">
          {list.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-body">
                No tickets yet — create one above to get started.
              </CardContent>
            </Card>
          ) : statusFilter === 'open' ? (
            <TicketGroup
              tickets={openList}
              emptyMessage="No open tickets right now."
            />
          ) : statusFilter === 'closed' ? (
            <TicketGroup
              tickets={closedList}
              emptyMessage="No closed tickets yet."
            />
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-body">
                  Open ({openList.length})
                </h2>
                <TicketGroup
                  tickets={openList}
                  emptyMessage="No open tickets right now."
                />
              </section>
              {closedList.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-body">
                    Closed ({closedList.length})
                  </h2>
                  <TicketGroup tickets={closedList} emptyMessage="" />
                </section>
              )}
            </>
          )}
        </div>

        {/* Side column — quota + support team. Quota stays adjacent to
         *  the ticket list so users see how many request slots are left
         *  before they hit the "Create New Ticket" button. */}
        <aside className="space-y-4">
          {quota.tier && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">This week</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-body">Plan</span>
                  <Badge variant="secondary">{quota.tier}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Used</span>
                  <span className="text-heading">
                    {quota.used_this_week}
                    {quota.cap !== 'unlimited' && (
                      <span className="text-body"> / {quota.total_allowance}</span>
                    )}
                  </span>
                </div>
                {quota.cap === 'unlimited' ? (
                  <Badge variant="success">Unlimited</Badge>
                ) : quota.remaining === 0 ? (
                  <p className="text-xs text-body">
                    No request slots left. Bug reports are always allowed; the
                    next request slot opens Monday.
                  </p>
                ) : (
                  <p className="text-xs text-body">
                    {quota.remaining as number} slot
                    {quota.remaining === 1 ? '' : 's'} remaining this week.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <SupportTeamCard members={team} />
        </aside>
      </div>
    </div>
  )
}

// Renders a list of ticket cards, or a single empty-state card when
// `tickets` is empty and a non-empty `emptyMessage` is supplied.
function TicketGroup({
  tickets,
  emptyMessage,
}: {
  tickets: TicketRow[]
  emptyMessage: string
}) {
  if (tickets.length === 0) {
    if (!emptyMessage) return null
    return (
      <Card>
        <CardContent className="p-6 text-sm text-body">{emptyMessage}</CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <TicketCardRow key={t.id} t={t} />
      ))}
    </div>
  )
}

// Single ticket row rendered as a card with a leading status icon —
// matches the reference's clock/check glyph + title + time-ago layout.
function TicketCardRow({ t }: { t: TicketRow }) {
  const closed = isClosed(t.status)
  return (
    <Link
      href={`/tickets/${t.id}`}
      className="block rounded-md border border-border-light bg-neutral-primary-soft p-4 transition-colors hover:bg-neutral-secondary-soft"
    >
      <div className="flex items-center gap-3">
        <span
          className={
            closed
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-tertiary-soft text-fg-disabled'
              : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-softer text-fg-brand'
          }
          aria-hidden
        >
          {closed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-heading">
              {t.subject}
            </span>
            <span className="text-xs text-body">#{t.ticket_number}</span>
            <Badge variant={t.type === 'bug' ? 'destructive' : 'info'}>
              {formatTicketType(t.type)}
            </Badge>
            {t.priority === 'urgent' && (
              <Badge variant="destructive">Urgent</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-body">{relativeTime(t.created_at)}</p>
        </div>
        <Badge variant={statusVariant[t.status] ?? 'secondary'}>
          {formatTicketStatus(t.status)}
        </Badge>
        <ChevronRight className="h-4 w-4 text-body" aria-hidden />
      </div>
    </Link>
  )
}
