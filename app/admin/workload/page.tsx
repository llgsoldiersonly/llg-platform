import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

type StaffRow = {
  id: string
  full_name: string | null
  role: string
  department_id: string | null
  is_department_manager: boolean | null
  department: { name: string; slug: string } | null
}

type TaskCount = {
  assigned_to: string | null
  status: string
}

export default async function WorkloadPage() {
  const supa = createAdminClient()

  const [{ data: staff }, { data: taskCounts }] = await Promise.all([
    supa
      .from('profiles')
      .select(`
        id, full_name, role, department_id, is_department_manager,
        department:departments(name, slug)
      `)
      .in('role', ['agency_staff', 'super_admin'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .returns<StaffRow[]>(),
    supa
      .from('tasks')
      .select('assigned_to, status')
      .neq('status', 'cancelled')
      .returns<TaskCount[]>(),
  ])

  const counts = (taskCounts ?? []).reduce<Record<string, { open: number; in_progress: number; done: number; total: number }>>((acc, t) => {
    const key = t.assigned_to ?? 'unassigned'
    acc[key] = acc[key] ?? { open: 0, in_progress: 0, done: 0, total: 0 }
    acc[key].total++
    if (t.status === 'done') acc[key].done++
    else if (t.status === 'in_progress' || t.status === 'in_review') acc[key].in_progress++
    else acc[key].open++
    return acc
  }, {})

  const list = staff ?? []
  const totalOpen = Object.values(counts).reduce((s, c) => s + c.open + c.in_progress, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Workload</h1>
        <p className="mt-1 text-sm text-body">
          {totalOpen} open + in-progress tasks across {list.length} team member{list.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const c = counts[s.id] ?? { open: 0, in_progress: 0, done: 0, total: 0 }
          const heat = c.open + c.in_progress
          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {s.full_name ?? s.id.slice(0, 8)}
                    </CardTitle>
                    <p className="mt-1 text-xs text-body">
                      {s.department?.name ?? 'No department'}
                      {s.is_department_manager && ' · manager'}
                      {s.role === 'super_admin' && ' · super admin'}
                    </p>
                  </div>
                  <Badge
                    variant={heat > 10 ? 'destructive' : heat > 5 ? 'warning' : 'success'}
                  >
                    {heat} active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-body">Open</dt>
                    <dd>{c.open}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-body">In progress / review</dt>
                    <dd>{c.in_progress}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-body">Done</dt>
                    <dd className="text-emerald-600">{c.done}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(counts.unassigned?.total ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unassigned</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-body">
            {counts.unassigned.total} task{counts.unassigned.total === 1 ? '' : 's'} have no assignee — pick them up at /admin/tasks.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
