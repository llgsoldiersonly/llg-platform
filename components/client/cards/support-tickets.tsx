import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTicketStatus } from '@/lib/tickets'

export type TicketSummary = {
  id: string
  ticket_number: number
  subject: string
  status: 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed'
  created_at: string
}

export function SupportTicketsCard({ tickets }: { tickets: TicketSummary[] }) {
  const open = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed')
  const closed = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg">Support &amp; Tickets</CardTitle>
        <Link href="/tickets/new">
          <Button size="sm">Create new ticket</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-3 text-center">
          <div>
            <div className="text-2xl font-semibold text-slate-900">{open.length}</div>
            <div className="text-xs uppercase tracking-wider text-slate-600">Open</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-900">{closed.length}</div>
            <div className="text-xs uppercase tracking-wider text-slate-600">Closed</div>
          </div>
        </div>

        {tickets.length === 0 ? (
          <p className="text-sm text-slate-600">
            No tickets yet. Open one any time something needs the team&apos;s attention.
          </p>
        ) : (
          <ul className="space-y-2">
            {tickets.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-brand-subtle hover:bg-brand-softer hover:shadow-md"
                >
                  <span className="flex-1 truncate text-sm text-slate-800 group-hover:text-fg-brand">
                    <span className="text-slate-500">#{t.ticket_number}</span>{' '}
                    {t.subject}
                  </span>
                  <TicketStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
            {tickets.length > 5 && (
              <li className="pt-1 text-right">
                <Link href="/tickets" className="text-xs text-fg-brand hover:underline">
                  View all {tickets.length} tickets →
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TicketStatusBadge({ status }: { status: TicketSummary['status'] }) {
  const variantMap: Record<TicketSummary['status'], 'success' | 'warning' | 'info' | 'secondary'> = {
    open: 'info',
    in_progress: 'warning',
    waiting_on_client: 'warning',
    resolved: 'success',
    closed: 'secondary',
  }
  return <Badge variant={variantMap[status]}>{formatTicketStatus(status)}</Badge>
}
