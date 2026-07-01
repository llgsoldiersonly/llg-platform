import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { TasksTable } from '@/app/admin/tasks/tasks-table'
import { CreateTaskButton } from '@/app/admin/tasks/create-task-button'

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
  department: { name: string; slug: string } | null
}

export default async function ClientTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()
  const canReopen = isSuperAdmin(user)

  const supa = createAdminClient()

  const [{ data: client }, { data: rawTasks }, { data: staff }, { data: departments }] =
    await Promise.all([
      supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
      supa
        .from('tasks')
        .select(`
          id, task_number, title, status, priority, start_date, due_date, created_at, assigned_to,
          department:departments(name, slug)
        `)
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .returns<RawTask[]>(),
      supa
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['agency_staff', 'super_admin'])
        .order('full_name', { ascending: true }),
      supa.from('departments').select('id, name, slug').order('name'),
    ])

  if (!client) notFound()

  const profileMap = new Map((staff ?? []).map((p) => [p.id, { id: p.id, full_name: p.full_name }]))

  const tasks = (rawTasks ?? []).map((t) => ({
    id: t.id,
    task_number: t.task_number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    start_date: t.start_date,
    due_date: t.due_date,
    created_at: t.created_at,
    client: { id: client.id, firm_name: client.firm_name },
    department: t.department,
    assignee: t.assigned_to
      ? profileMap.get(t.assigned_to) ?? { id: t.assigned_to, full_name: null }
      : null,
  }))

  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-heading">Tasks</h2>
          <p className="mt-1 text-sm text-body">
            {open.length} open · {tasks.length} total for {client.firm_name}
          </p>
        </div>
        <CreateTaskButton
          staff={staff ?? []}
          departments={departments ?? []}
          clients={[{ id: client.id, firm_name: client.firm_name }]}
          defaultClientId={client.id}
        />
      </div>

      <TasksTable tasks={tasks} canReopen={canReopen} />
    </div>
  )
}
