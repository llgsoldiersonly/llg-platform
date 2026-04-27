import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TasksTable } from './tasks-table'
import { CreateTaskButton } from './create-task-button'

export const dynamic = 'force-dynamic'

type Task = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  due_date: string | null
  created_at: string
  client: { id: string; firm_name: string } | null
  department: { name: string; slug: string } | null
  assignee: { id: string; full_name: string | null } | null
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filterStatus = typeof params.status === 'string' ? params.status : null
  const filterAssignee = typeof params.assignee === 'string' ? params.assignee : null

  const supa = createAdminClient()

  let query = supa
    .from('tasks')
    .select(`
      id, task_number, title, status, priority, due_date, created_at,
      client:clients(id, firm_name),
      department:departments(name, slug),
      assignee:profiles!tasks_assigned_to_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filterStatus) query = query.eq('status', filterStatus)
  if (filterAssignee) query = query.eq('assigned_to', filterAssignee)

  const [{ data: tasks }, { data: staff }, { data: departments }, { data: clients }] = await Promise.all([
    query.returns<Task[]>(),
    supa
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['agency_staff', 'super_admin'])
      .order('full_name', { ascending: true }),
    supa.from('departments').select('id, name, slug').order('name'),
    supa.from('clients').select('id, firm_name').order('firm_name'),
  ])

  const list = tasks ?? []
  const open = list.filter((t) => t.status !== 'done' && t.status !== 'cancelled')

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">
            {open.length} open · {list.length} total
          </p>
        </div>
        <CreateTaskButton
          staff={staff ?? []}
          departments={departments ?? []}
          clients={clients ?? []}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['todo', 'in_progress', 'in_review', 'blocked', 'done'].map((s) => (
              <a
                key={s}
                href={filterStatus === s ? '/admin/tasks' : `/admin/tasks?status=${s}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
                  filterStatus === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.replace('_', ' ')}
              </a>
            ))}
            {filterStatus && (
              <a
                href="/admin/tasks"
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                clear
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <TasksTable tasks={list} />
    </div>
  )
}
