import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { getQuotaState } from '@/lib/tickets/quota'
import { formatTicketType, formatTicketCategory, formatTicketStatus } from '@/lib/tickets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, ChevronRight } from 'lucide-react'

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

export default async function ClientTicketsPage() {
  const ctx = await getClientContext()
  if (!ctx) redirect('/login')

  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, type, subject, category, priority, status, created_at, sla_deadline_at')
    .eq('client_id', ctx.client.id)
    .order('created_at', { ascending: false })
    .returns<TicketRow[]>()

  // Use service role via the server client is not possible from a client
  // context, but we can use the regular client and let RLS filter — the
  // quota table has a policy that lets clients see their own row.
  const quota = await getQuotaState(supabase, ctx.client.id)

  const list = tickets ?? []
  const open = list.filter((t) => t.status !== 'closed' && t.status !== 'resolved')
  const closed = list.filter((t) => t.status === 'closed' || t.status === 'resolved')

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Submit a bug if something's broken, or a request for new work
          </p>
        </div>
        <Link href="/tickets/new">
          <Button>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent>
          {quota.tier ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Plan</span>
                <Badge variant="secondary">{quota.tier}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Requests used this week</span>
                <span className="text-slate-900">
                  {quota.used_this_week}
                  {quota.cap !== 'unlimited' && (
                    <span className="text-slate-500"> / {quota.total_allowance}</span>
                  )}
                </span>
              </div>
              {quota.cap === 'unlimited' ? (
                <Badge variant="success">Unlimited</Badge>
              ) : quota.remaining === 0 ? (
                <p className="text-xs text-slate-500">
                  No request slots left this week. Bug reports are always allowed.
                  Your next request slot opens Monday.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {quota.remaining as number} request slot{quota.remaining === 1 ? '' : 's'} remaining this week.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active subscription.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open ({open.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {open.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No open tickets. Nice.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {open.map((t) => (
                <TicketLi key={t.id} t={t} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Closed ({closed.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {closed.slice(0, 10).map((t) => (
                <TicketLi key={t.id} t={t} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TicketLi({ t }: { t: TicketRow }) {
  return (
    <li>
      <Link
        href={`/tickets/${t.id}`}
        className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">#{t.ticket_number}</span>
            <span className="text-slate-700">{t.subject}</span>
            <Badge variant={t.type === 'bug' ? 'destructive' : 'info'}>
              {formatTicketType(t.type)}
            </Badge>
            {t.priority === 'urgent' && <Badge variant="destructive">Urgent</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatTicketCategory(t.category)} · opened {new Date(t.created_at).toLocaleDateString()}
            {t.sla_deadline_at && (
              <> · SLA {new Date(t.sla_deadline_at).toLocaleString()}</>
            )}
          </p>
        </div>
        <Badge variant={statusVariant[t.status] ?? 'secondary'}>
          {formatTicketStatus(t.status)}
        </Badge>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </Link>
    </li>
  )
}
