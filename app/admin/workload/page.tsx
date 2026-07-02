import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/ui/infotip'

export const dynamic = 'force-dynamic'

type StaffRow = {
  id: string
  full_name: string | null
  role: string
  weekly_capacity_hours: number | null
  department: { name: string; slug: string } | null
}

type TaskRow = {
  assigned_to: string | null
  status: string
  due_date: string | null
  estimated_hours: number | null
  parent_task_id: string | null
}

type DelivRow = { assigned_to: string | null; status: string }

type Load = {
  weekHours: number      // estimated hours due within 7 days (or overdue)
  backlogHours: number   // estimated hours on ALL open tasks
  weekCount: number
  openCount: number
  unestimated: number    // open tasks with no estimate (invisible to the bars)
  deliverables: number   // open deliverables assigned
}

const EMPTY: Load = { weekHours: 0, backlogHours: 0, weekCount: 0, openCount: 0, unestimated: 0, deliverables: 0 }

export default async function WorkloadPage() {
  const supa = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: staff }, { data: tasks }, { data: deliverables }] = await Promise.all([
    supa
      .from('profiles')
      .select('id, full_name, role, weekly_capacity_hours, department:departments(name, slug)')
      .in('role', ['agency_staff', 'super_admin'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .returns<StaffRow[]>(),
    supa
      .from('tasks')
      .select('assigned_to, status, due_date, estimated_hours, parent_task_id')
      .not('status', 'in', '("done","cancelled")')
      .returns<TaskRow[]>(),
    supa
      .from('deliverables_display')
      .select('assigned_to, status')
      .not('assigned_to', 'is', null)
      .not('status', 'in', '("done","skipped")')
      .returns<DelivRow[]>(),
  ])

  const loads: Record<string, Load> = {}
  const loadFor = (key: string) => (loads[key] ??= { ...EMPTY })

  for (const t of tasks ?? []) {
    const l = loadFor(t.assigned_to ?? 'unassigned')
    const hrs = t.estimated_hours ?? 0
    l.openCount++
    if (t.estimated_hours == null) l.unestimated++
    l.backlogHours += hrs
    // "This week" = due in the next 7 days or already overdue. No due date →
    // backlog only.
    if (t.due_date && t.due_date <= weekEnd) {
      l.weekHours += hrs
      l.weekCount++
    }
  }
  for (const d of deliverables ?? []) {
    if (d.assigned_to) loadFor(d.assigned_to).deliverables++
  }

  const list = staff ?? []
  const unassigned = loads.unassigned ?? { ...EMPTY }
  const totalWeekHours = list.reduce((s, p) => s + (loads[p.id]?.weekHours ?? 0), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Workload</h1>
        <p className="mt-1 text-sm text-body">
          Estimated hours due in the next 7 days vs. each person&apos;s weekly capacity —{' '}
          {Math.round(totalWeekHours)}h scheduled team-wide. Set capacity per person in{' '}
          <Link href="/admin/settings/users" className="text-fg-brand hover:underline">
            Settings → Users
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const l = loads[s.id] ?? EMPTY
          const capacity = Number(s.weekly_capacity_hours ?? 40) || 40
          const pct = Math.round((l.weekHours / capacity) * 100)
          const over = pct > 100
          const barPct = Math.min(pct, 100)
          const barColor = over ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#10b981'
          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{s.full_name ?? s.id.slice(0, 8)}</CardTitle>
                    <p className="mt-1 text-xs text-body">
                      {s.department?.name ?? 'No department'}
                      {s.role === 'super_admin' && ' · super admin'}
                    </p>
                  </div>
                  <InfoTip text="Estimated hours on their tasks due in the next 7 days (or overdue), divided by their weekly capacity. Amber from 80%, red over 100%.">
                    <Badge variant={over ? 'destructive' : pct >= 80 ? 'warning' : 'success'}>
                      {pct}%
                    </Badge>
                  </InfoTip>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-body">
                    <span>This week</span>
                    <span className={over ? 'font-medium text-fg-danger-strong' : ''}>
                      {l.weekHours}h / {capacity}h
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-secondary-soft">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  {over && (
                    <p className="mt-1 text-xs font-medium text-fg-danger-strong">
                      {l.weekHours - capacity}h over capacity
                    </p>
                  )}
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-body">Tasks due this week</dt>
                    <dd>{l.weekCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-body">Open backlog</dt>
                    <dd>
                      {l.openCount} task{l.openCount === 1 ? '' : 's'} · {l.backlogHours}h
                    </dd>
                  </div>
                  {l.deliverables > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-body">Deliverables</dt>
                      <dd>{l.deliverables}</dd>
                    </div>
                  )}
                  {l.unestimated > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-body">No estimate</dt>
                      <dd className="text-fg-warning-strong">{l.unestimated}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {unassigned.openCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unassigned</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-body">
            {unassigned.openCount} task{unassigned.openCount === 1 ? '' : 's'} ({unassigned.backlogHours}h
            estimated) have no owner —{' '}
            <Link href="/admin/tasks/board" className="text-fg-brand hover:underline">
              assign them on the board
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-body-subtle">
        Hours come from each task&apos;s estimate (set on the task detail page). Tasks without an
        estimate are counted but can&apos;t contribute hours — the &ldquo;No estimate&rdquo; number
        tells you how blind each bar is.
      </p>
    </div>
  )
}
