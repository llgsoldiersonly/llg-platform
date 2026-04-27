import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

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
  sla_deadline_at: string | null
  assigned_user_id: string | null
  client: { id: string; firm_name: string } | null
  department: { name: string; slug: string } | null
}

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'secondary' | 'destructive'> = {
  open: 'info',
  in_progress: 'info',
  waiting_on_client: 'warning',
  resolved: 'success',
  closed: 'secondary',
}

function slaState(deadline: string | null): { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } {
  if (!deadline) return { label: 'no SLA', variant: 'secondary' }
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms < 0) return { label: `breached ${Math.round(-ms / 3600000)}h ago`, variant: 'destructive' }
  if (ms < 4 * 3600000) return { label: `${Math.round(ms / 3600000)}h left`, variant: 'warning' }
  return { label: `${Math.round(ms / 3600000)}h left`, variant: 'success' }
}

export default async function AdminTicketsPage() {
  const supa = createAdminClient()
  const [{ data: rawTickets }, { data: assignees }] = await Promise.all([
    supa
      .from('tickets')
      .select(`
        id, ticket_number, type, subject, category, priority, status, created_at, sla_deadline_at,
        assigned_user_id,
        client:clients(id, firm_name),
        department:departments!tickets_assigned_department_id_fkey(name, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<TicketRow[]>(),
    supa.from('profiles').select('id, full_name'),
  ])

  const profileMap = new Map<string, string | null>()
  for (const p of assignees ?? []) profileMap.set(p.id, p.full_name)

  const list = (rawTickets ?? []).map((t) => ({
    ...t,
    assigned_user: t.assigned_user_id
      ? { full_name: profileMap.get(t.assigned_user_id) ?? null }
      : null,
  }))
  const open = list.filter((t) => t.status !== 'closed' && t.status !== 'resolved')
  const closed = list.filter((t) => t.status === 'closed' || t.status === 'resolved')

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
        <p className="mt-1 text-sm text-slate-500">
          {open.length} open · {closed.length} closed (last 100)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {open.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No open tickets.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {open.map((t) => {
                const sla = slaState(t.sla_deadline_at)
                return (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="grid grid-cols-12 items-center gap-3 px-6 py-4 hover:bg-slate-50"
                    >
                      <div className="col-span-7">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">#{t.ticket_number}</span>
                          <Badge variant={t.type === 'bug' ? 'destructive' : 'info'}>{t.type}</Badge>
                          <span className="text-slate-700">{t.subject}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {t.client?.firm_name ?? '—'} · {t.category ?? '—'}
                          {t.department && <> → {t.department.name}</>}
                          {t.assigned_user?.full_name && <> → {t.assigned_user.full_name}</>}
                        </p>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                      <div className="col-span-2">
                        <Badge variant={sla.variant}>{sla.label}</Badge>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <Badge variant={statusVariant[t.status] ?? 'secondary'}>
                          {t.status.replace(/_/g, ' ')}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently closed</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {closed.slice(0, 20).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="flex items-center justify-between px-6 py-3 text-sm hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">#{t.ticket_number}</span>
                      <span className="text-slate-700">{t.subject}</span>
                      <span className="text-xs text-slate-400">{t.client?.firm_name ?? '—'}</span>
                    </div>
                    <Badge variant="secondary">{t.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
