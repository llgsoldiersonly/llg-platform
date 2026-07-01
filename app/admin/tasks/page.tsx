import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TasksTable } from './tasks-table'
import { CreateTaskButton } from './create-task-button'

export const dynamic = 'force-dynamic'

type RawTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  created_at: string
  assigned_to: string | null
  client: { id: string; firm_name: string } | null
  department: { name: string; slug: string } | null
}

type Profile = { id: string; full_name: string | null }

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filterStatus = typeof params.status === 'string' ? params.status : null
  const filterAssignee = typeof params.assignee === 'string' ? params.assignee : null

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const canReopen = isSuperAdmin(user)

  const supa = createAdminClient()

  // Tasks → assignee join can't be expressed as a FK relationship in PostgREST
  // (tasks.assigned_to FKs to auth.users, not public.profiles). Fetch tasks
  // and look up assignee names in a second query, then merge in code.
  let query = supa
    .from('tasks')
    .select(`
      id, task_number, title, status, priority, start_date, due_date, created_at, assigned_to,
      client:clients(id, firm_name),
      department:departments(name, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filterStatus) query = query.eq('status', filterStatus)
  if (filterAssignee) query = query.eq('assigned_to', filterAssignee)

  const [{ data: rawTasks }, { data: staff }, { data: departments }, { data: clients }] =
    await Promise.all([
      query.returns<RawTask[]>(),
      supa
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['agency_staff', 'super_admin'])
        .order('full_name', { ascending: true }),
      supa.from('departments').select('id, name, slug').order('name'),
      supa.from('clients').select('id, firm_name').order('firm_name'),
    ])

  // Map assignee_id -> profile so the table can show full_name
  const profileMap = new Map<string, Profile>()
  for (const p of staff ?? []) {
    profileMap.set(p.id, { id: p.id, full_name: p.full_name })
  }

  const tasks = (rawTasks ?? []).map((t) => ({
    id: t.id,
    task_number: t.task_number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    start_date: t.start_date,
    due_date: t.due_date,
    created_at: t.created_at,
    client: t.client,
    department: t.department,
    assignee: t.assigned_to ? profileMap.get(t.assigned_to) ?? { id: t.assigned_to, full_name: null } : null,
  }))

  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Tasks</h1>
          <p className="mt-1 text-sm text-body">
            {open.length} open · {tasks.length} total
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
                    ? 'bg-dark text-white'
                    : 'bg-neutral-tertiary-soft text-body hover:bg-neutral-quaternary'
                }`}
              >
                {s.replace('_', ' ')}
              </a>
            ))}
            {filterStatus && (
              <a
                href="/admin/tasks"
                className="text-xs text-body hover:text-heading"
              >
                clear
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <TasksTable tasks={tasks} canReopen={canReopen} />
    </div>
  )
}
