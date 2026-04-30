import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatTicketType, formatTicketCategory, formatTicketPriority, formatTicketStatus } from '@/lib/tickets'
import { ChevronLeft } from 'lucide-react'
import { AdminTicketActions } from './ticket-actions'

export const dynamic = 'force-dynamic'

type Ticket = {
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
  escalated_at: string | null
  client_id: string
  assigned_department_id: string | null
  assigned_user_id: string | null
  client: { firm_name: string } | null
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

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: ticket }, { data: messages }, { data: staff }, { data: departments }] =
    await Promise.all([
      supa
        .from('tickets')
        .select(`
          id, ticket_number, type, subject, category, priority, status, created_at,
          closed_at, close_reason, sla_deadline_at, escalated_at,
          client_id, assigned_department_id, assigned_user_id,
          client:clients(firm_name)
        `)
        .eq('id', id)
        .maybeSingle()
        .returns<Ticket | null>(),
      supa
        .from('ticket_messages')
        .select('id, author_id, body, is_internal_note, created_at')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })
        .returns<Message[]>(),
      supa
        .from('profiles')
        .select('id, full_name, role, department_id')
        .in('role', ['agency_staff', 'super_admin'])
        .order('full_name', { ascending: true }),
      supa.from('departments').select('id, name, slug').order('name'),
    ])

  if (!ticket) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Link
        href="/admin/tickets"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to all tickets
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-600">
                Ticket #{ticket.ticket_number} · {ticket.client?.firm_name ?? '—'}
              </p>
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
                {ticket.escalated_at && <Badge variant="destructive">Escalated</Badge>}
              </div>
              {ticket.sla_deadline_at && ticket.status !== 'closed' && (
                <p className="mt-2 text-xs text-slate-600">
                  SLA: {new Date(ticket.sla_deadline_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <AdminTicketActions
        ticketId={ticket.id}
        currentDepartmentId={ticket.assigned_department_id}
        currentAssigneeId={ticket.assigned_user_id}
        status={ticket.status}
        staff={staff ?? []}
        departments={departments ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={
                m.is_internal_note
                  ? 'rounded-md border border-amber-200 bg-amber-50 p-4'
                  : 'rounded-md border border-slate-100 p-4'
              }
            >
              <p className="mb-1 text-xs text-slate-600">
                {new Date(m.created_at).toLocaleString()}
                {m.is_internal_note && ' · INTERNAL NOTE (clients cannot see)'}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-900">{m.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
