import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { getLeadScope } from '@/lib/auth/department'
import { Card, CardContent } from '@/components/ui/card'
import { KanbanBoard, type KanbanItem, type BoardStatus } from '@/components/admin/kanban-board'

export const dynamic = 'force-dynamic'

type RawTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  assigned_to: string | null
  block_reason: string | null
  client: { id: string; firm_name: string } | null
}
type RawDeliverable = {
  id: string
  title: string
  status: string
  client_id: string
  assigned_to: string | null
  period_start: string
}

const TASK_BOARD: BoardStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'done']

function deliverableToBoard(s: string): BoardStatus {
  switch (s) {
    case 'pending': return 'todo'
    case 'in_progress': return 'in_progress'
    case 'blocked': return 'blocked'
    case 'done': return 'done'
    default: return 'done'
  }
}

export default async function DepartmentBoardPage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login?next=/staff/department')

  const supa = createAdminClient()
  const scope = await getLeadScope(supa, user.id)

  // Only department leads have a department board. (Super-admins run the global
  // /admin board and don't use /staff.)
  if (!scope.isLead || !scope.departmentId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Department</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-body">
            You&apos;re not set as a department lead. Ask a super-admin to enable it on your user if
            you should be managing a department.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: dept } = await supa
    .from('departments')
    .select('name, slug')
    .eq('id', scope.departmentId)
    .maybeSingle<{ name: string; slug: string }>()

  const [{ data: rawTasks }, { data: rawDeliv }, { data: staff }, { data: firms }] = await Promise.all([
    supa
      .from('tasks')
      .select('id, task_number, title, status, priority, assigned_to, block_reason, client:clients(id, firm_name)')
      .eq('department_id', scope.departmentId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<RawTask[]>(),
    supa
      .from('deliverables_display')
      .select('id, title, status, client_id, assigned_to, period_start')
      .eq('department_slug', dept?.slug ?? '')
      .neq('status', 'skipped')
      .returns<RawDeliverable[]>(),
    supa
      .from('profiles')
      .select('id, full_name, department_id, is_active')
      .in('role', ['agency_staff', 'super_admin'])
      .returns<{ id: string; full_name: string | null; department_id: string | null; is_active: boolean }[]>(),
    supa.from('clients').select('id, firm_name').returns<{ id: string; firm_name: string }[]>(),
  ])

  const nameById = new Map((staff ?? []).map((p) => [p.id, p.full_name]))
  const firmById = new Map((firms ?? []).map((f) => [f.id, f.firm_name]))

  // Reassign targets: active members of this department.
  const assignableStaff = (staff ?? [])
    .filter((p) => p.is_active && p.department_id === scope.departmentId)
    .map((p) => ({ id: p.id, name: p.full_name ?? 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const taskItems: KanbanItem[] = (rawTasks ?? [])
    .filter((t) => TASK_BOARD.includes(t.status as BoardStatus))
    .map((t) => ({
      kind: 'task' as const,
      id: t.id,
      title: t.title,
      meta: `#${t.task_number}${t.client ? ` · ${t.client.firm_name}` : ' · internal'}`,
      boardStatus: t.status as BoardStatus,
      priority: t.priority,
      clientId: t.client?.id ?? null,
      assigneeName: t.assigned_to ? nameById.get(t.assigned_to) ?? null : null,
      assigneeId: t.assigned_to,
      blockReason: t.block_reason,
    }))

  const delivItems: KanbanItem[] = (rawDeliv ?? []).map((d) => ({
    kind: 'deliverable' as const,
    id: d.id,
    title: d.title,
    meta: `${firmById.get(d.client_id) ?? 'client'} · ${d.period_start.slice(0, 7)}`,
    boardStatus: deliverableToBoard(d.status),
    priority: null,
    clientId: d.client_id,
    assigneeName: d.assigned_to ? nameById.get(d.assigned_to) ?? null : null,
  }))

  const items = [...taskItems, ...delivItems]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">{dept?.name ?? 'Department'} — team board</h1>
          <p className="mt-1 text-sm text-body">
            Every task and deliverable in {dept?.name ?? 'your department'}, across all clients.
            Filter by assignee, reassign, and submit within your department.
          </p>
        </div>
        <Link href="/staff/board" className="text-sm text-fg-brand hover:underline">
          My Work →
        </Link>
      </div>
      <KanbanBoard
        items={items}
        canReopen={isSuperAdmin(user)}
        canSubmit
        showAssigneeFilter
        taskDetailBase="/staff/tasks"
        assignableStaff={assignableStaff}
      />
    </div>
  )
}
