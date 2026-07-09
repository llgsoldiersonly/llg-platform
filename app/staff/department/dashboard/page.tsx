import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLeadScope } from '@/lib/auth/department'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/ui/infotip'

export const dynamic = 'force-dynamic'

type DeptTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  due_date: string | null
  estimated_hours: number | null
  assigned_to: string | null
  block_reason: string | null
  parent_task_id: string | null
  updated_at: string | null
  client: { firm_name: string } | null
}

type Member = { id: string; full_name: string | null; weekly_capacity_hours: number | null }

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000))
}

export default async function DepartmentDashboardPage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login?next=/staff/department/dashboard')

  const supa = createAdminClient()
  const scope = await getLeadScope(supa, user.id)

  if (!scope.isLead || !scope.departmentId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-heading">Department dashboard</h1>
        <Card>
          <CardContent className="p-6 text-sm text-body">
            This view is for department leads. If you should be one, ask a super-admin to flag you in
            Settings → Users.
          </CardContent>
        </Card>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const [{ data: dept }, { data: members }, { data: tasks }] = await Promise.all([
    supa.from('departments').select('name').eq('id', scope.departmentId).maybeSingle<{ name: string }>(),
    supa
      .from('profiles')
      .select('id, full_name, weekly_capacity_hours')
      .eq('department_id', scope.departmentId)
      .eq('is_active', true)
      .order('full_name')
      .returns<Member[]>(),
    supa
      .from('tasks')
      .select(
        'id, task_number, title, status, priority, due_date, estimated_hours, assigned_to, block_reason, parent_task_id, updated_at, client:clients(firm_name)'
      )
      .eq('department_id', scope.departmentId)
      .not('status', 'in', '("done","cancelled")')
      .returns<DeptTask[]>(),
  ])

  const all = tasks ?? []
  const memberList = members ?? []
  const nameById = new Map(memberList.map((m) => [m.id, m.full_name ?? 'Unknown']))

  const overdue = all
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
  const inReview = all
    .filter((t) => t.status === 'in_review')
    .sort((a, b) => ((a.updated_at ?? '') < (b.updated_at ?? '') ? -1 : 1))
  const paused = all.filter((t) => t.status === 'blocked')
  const unassigned = all.filter((t) => !t.assigned_to)

  // 7-day scheduled hours per member — same formula as /admin/workload.
  const memberLoad = new Map<string, { weekHours: number; open: number }>()
  for (const t of all) {
    if (!t.assigned_to) continue
    const l = memberLoad.get(t.assigned_to) ?? { weekHours: 0, open: 0 }
    l.open++
    if (t.due_date && t.due_date <= weekEnd) l.weekHours += t.estimated_hours ?? 0
    memberLoad.set(t.assigned_to, l)
  }

  const stats: { label: string; value: number; tone?: 'danger' | 'warn' }[] = [
    { label: 'Open tasks', value: all.length },
    { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'danger' : undefined },
    { label: 'Awaiting your review', value: inReview.length, tone: inReview.length ? 'warn' : undefined },
    { label: 'Paused', value: paused.length },
    { label: 'Unassigned', value: unassigned.length, tone: unassigned.length ? 'warn' : undefined },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">
            {dept?.name ?? 'Department'} — manager dashboard
          </h1>
          <p className="mt-1 text-sm text-body">
            Where your attention is needed: review queue first, then overdue, then who&apos;s drowning.
          </p>
        </div>
        <Link href="/staff/department" className="text-sm text-fg-brand hover:underline">
          Open the board →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p
                className={`text-2xl font-semibold ${
                  s.tone === 'danger' ? 'text-fg-danger-strong' : s.tone === 'warn' ? 'text-fg-warning-strong' : 'text-heading'
                }`}
              >
                {s.value}
              </p>
              <p className="mt-0.5 text-xs text-body">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Review queue{' '}
              <InfoTip text="Tasks your team finished that are waiting on you (or a super-admin) to approve and Submit. Longest-waiting first." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inReview.length === 0 ? (
              <p className="text-sm text-body-subtle">Nothing waiting on you 🎉</p>
            ) : (
              inReview.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border-default p-2.5">
                  <div className="min-w-0">
                    <Link href={`/staff/tasks/${t.id}`} className="text-sm font-medium text-heading hover:text-fg-brand hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-body-subtle">
                      #{t.task_number} · {t.client?.firm_name ?? 'internal'} ·{' '}
                      {t.assigned_to ? nameById.get(t.assigned_to) ?? 'someone' : 'unassigned'}
                    </p>
                  </div>
                  <Badge variant="warning">
                    {daysBetween(t.updated_at ?? now, now)}d waiting
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.length === 0 ? (
              <p className="text-sm text-body-subtle">Nothing overdue 🎉</p>
            ) : (
              overdue.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border-default p-2.5">
                  <div className="min-w-0">
                    <Link href={`/staff/tasks/${t.id}`} className="text-sm font-medium text-heading hover:text-fg-brand hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-body-subtle">
                      #{t.task_number} · {t.client?.firm_name ?? 'internal'} ·{' '}
                      {t.assigned_to ? nameById.get(t.assigned_to) ?? 'someone' : 'unassigned'}
                    </p>
                  </div>
                  <Badge variant="destructive">{daysBetween(t.due_date!, today)}d late</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paused — why</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paused.length === 0 ? (
              <p className="text-sm text-body-subtle">Nothing paused.</p>
            ) : (
              paused.slice(0, 10).map((t) => (
                <div key={t.id} className="rounded border border-border-default p-2.5">
                  <Link href={`/staff/tasks/${t.id}`} className="text-sm font-medium text-heading hover:text-fg-brand hover:underline">
                    {t.title}
                  </Link>
                  <p className="text-xs text-body">⏸ {t.block_reason ?? 'no reason given'}</p>
                  <p className="text-xs text-body-subtle">
                    {t.assigned_to ? nameById.get(t.assigned_to) ?? 'someone' : 'unassigned'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Team load{' '}
              <InfoTip text="Estimated hours on tasks due in the next 7 days vs. each person's weekly capacity — same formula as the admin Workload page. Amber from 80%, red over 100%." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberList.length === 0 ? (
              <p className="text-sm text-body-subtle">No active members in this department.</p>
            ) : (
              memberList.map((m) => {
                const load = memberLoad.get(m.id) ?? { weekHours: 0, open: 0 }
                const capacity = Number(m.weekly_capacity_hours ?? 40) || 40
                const pct = Math.round((load.weekHours / capacity) * 100)
                const barColor = pct > 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#10b981'
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-heading">{m.full_name ?? m.id.slice(0, 8)}</span>
                      <span className="text-body-subtle">
                        {load.weekHours}h / {capacity}h · {load.open} open
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-secondary-soft">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {unassigned.length > 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-body">
            {unassigned.length} task{unassigned.length === 1 ? '' : 's'} in your department{' '}
            {unassigned.length === 1 ? 'has' : 'have'} no owner —{' '}
            <Link href="/staff/department" className="text-fg-brand hover:underline">
              assign them on the board
            </Link>
            .
          </CardContent>
        </Card>
      )}
    </div>
  )
}
