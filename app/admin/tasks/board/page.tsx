import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { KanbanBoard, type KanbanItem, type BoardStatus } from '@/components/admin/kanban-board'

export const dynamic = 'force-dynamic'

type RawTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  assigned_to: string | null
  client: { id: string; firm_name: string } | null
}

const BOARD_STATUSES: BoardStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'done']

export default async function TasksBoardPage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const canReopen = isSuperAdmin(user)

  const supa = createAdminClient()
  const [{ data: rawTasks }, { data: staff }] = await Promise.all([
    supa
      .from('tasks')
      .select('id, task_number, title, status, priority, assigned_to, client:clients(id, firm_name)')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<RawTask[]>(),
    supa
      .from('profiles')
      .select('id, full_name')
      .in('role', ['agency_staff', 'super_admin']),
  ])

  const nameById = new Map((staff ?? []).map((p) => [p.id, p.full_name]))

  const items: KanbanItem[] = (rawTasks ?? [])
    .filter((t) => BOARD_STATUSES.includes(t.status as BoardStatus))
    .map((t) => ({
      kind: 'task' as const,
      id: t.id,
      title: t.title,
      meta: `#${t.task_number}${t.client ? ` · ${t.client.firm_name}` : ' · internal'}`,
      boardStatus: t.status as BoardStatus,
      priority: t.priority,
      clientId: t.client?.id ?? null,
      assigneeName: t.assigned_to ? nameById.get(t.assigned_to) ?? null : null,
    }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Task board</h1>
          <p className="mt-1 text-sm text-body">
            Everyone&apos;s tasks — drag a card to change its status. Filter by assignee to focus one person.
          </p>
        </div>
        <Link href="/admin/tasks" className="text-sm text-fg-brand hover:underline">
          List view →
        </Link>
      </div>

      <KanbanBoard items={items} canReopen={canReopen} showAssigneeFilter />
    </div>
  )
}
