import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatTicketType, formatTicketCategory, formatTicketPriority, formatTicketStatus } from '@/lib/tickets'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { ClientReplyBox } from './reply-box'

export const dynamic = 'force-dynamic'

type TicketRow = {
  id: string
  ticket_number: number
  type: 'bug' | 'request'
  subject: string
  category: string | null
  priority: string
  status: string
  created_at: string
  closed_at: string | null
  close_reason: string | null
  sla_deadline_at: string | null
  client_id: string
}

type Message = {
  id: string
  author_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'secondary' | 'destructive'> = {
  open: 'info',
  in_progress: 'info',
  waiting_on_client: 'warning',
  resolved: 'success',
  closed: 'secondary',
}

export default async function ClientTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getClientContext()
  if (!ctx) redirect('/login')

  const supabase = await createClient()
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, ticket_number, type, subject, category, priority, status, created_at, closed_at, close_reason, sla_deadline_at, client_id')
      .eq('id', id)
      .maybeSingle()
      .returns<TicketRow | null>(),
    supabase
      .from('ticket_messages')
      .select('id, author_id, body, is_internal_note, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
      .returns<Message[]>(),
  ])

  if (!ticket) notFound()
  if (ticket.client_id !== ctx.client.id) notFound() // RLS would do this too but be explicit

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Ticket #{ticket.ticket_number}</p>
              <CardTitle className="mt-1 text-xl">{ticket.subject}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={ticket.type === 'bug' ? 'destructive' : 'info'}>
                  {formatTicketType(ticket.type)}
                </Badge>
                <Badge variant="secondary">{formatTicketCategory(ticket.category)}</Badge>
                <Badge variant={ticket.priority === 'urgent' ? 'destructive' : 'secondary'}>
                  {formatTicketPriority(ticket.priority)}
                </Badge>
                <Badge variant={statusVariant[ticket.status] ?? 'secondary'}>
                  {formatTicketStatus(ticket.status)}
                </Badge>
              </div>
              {ticket.sla_deadline_at && ticket.status !== 'closed' && (
                <p className="mt-2 text-xs text-slate-500">
                  SLA deadline: {new Date(ticket.sla_deadline_at).toLocaleString()}
                </p>
              )}
              {ticket.closed_at && (
                <p className="mt-2 text-xs text-slate-500">
                  Closed {new Date(ticket.closed_at).toLocaleString()}
                  {ticket.close_reason && <> — {ticket.close_reason}</>}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(messages ?? []).map((m) => (
            <div key={m.id} className="rounded-md border border-slate-100 p-4">
              <p className="mb-1 text-xs text-slate-500">
                {new Date(m.created_at).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-900">{m.body}</p>
            </div>
          ))}
          {ticket.status !== 'closed' && <ClientReplyBox ticketId={ticket.id} />}
          {ticket.status === 'closed' && ticket.close_reason === 'inactivity' && (
            <ReopenButton ticketId={ticket.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReopenButton({ ticketId }: { ticketId: string }) {
  return (
    <form action={`/api/tickets/${ticketId}/reopen`} method="post">
      <Button variant="outline" type="submit">
        Reopen this ticket
      </Button>
      <p className="mt-2 text-xs text-slate-500">
        This ticket was auto-closed for inactivity. Reopening it brings it back to your queue.
      </p>
    </form>
  )
}
