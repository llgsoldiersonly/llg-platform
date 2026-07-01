import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { KanbanBoard, type KanbanItem, type BoardStatus } from '@/components/admin/kanban-board'

export const dynamic = 'force-dynamic'

type RawTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  block_reason: string | null
  parent_task_id: string | null
  client: { id: string; firm_name: string } | null
}
type RawDeliverable = {
  id: string
  title: string
  status: string
  client_id: string
  period_start: string
  period_end: string
}

const TASK_BOARD: BoardStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'done']

// Deliverable enum → board column.
function deliverableToBoard(s: string): BoardStatus {
  switch (s) {
    case 'pending': return 'todo'
    case 'in_progress': return 'in_progress'
    case 'blocked': return 'blocked'
    case 'done': return 'done'
    default: return 'done' // skipped, etc.
  }
}

export default async function MyWorkBoardPage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login?next=/staff/board')

  const supa = createAdminClient()
  const [{ data: rawTasks }, { data: rawDeliv }, { data: firms }] = await Promise.all([
    supa
      .from('tasks')
      .select('id, task_number, title, status, priority, block_reason, parent_task_id, client:clients(id, firm_name)')
      .eq('assigned_to', user.id)
      .neq('status', 'cancelled')
      .returns<RawTask[]>(),
    supa
      .from('deliverables_display')
      .select('id, title, status, client_id, period_start, period_end')
      .eq('assigned_to', user.id)
      .neq('status', 'skipped')
      .returns<RawDeliverable[]>(),
    supa.from('clients').select('id, firm_name').returns<{ id: string; firm_name: string }[]>(),
  ])

  const firmById = new Map((firms ?? []).map((f) => [f.id, f.firm_name]))

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
      blockReason: t.block_reason,
      isSubtask: !!t.parent_task_id,
    }))

  const delivItems: KanbanItem[] = (rawDeliv ?? []).map((d) => ({
    kind: 'deliverable' as const,
    id: d.id,
    title: d.title,
    meta: `${firmById.get(d.client_id) ?? 'client'} · ${d.period_start.slice(0, 7)}`,
    boardStatus: deliverableToBoard(d.status),
    priority: null,
    clientId: d.client_id,
  }))

  const items = [...taskItems, ...delivItems]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">My Work</h1>
        <p className="mt-1 text-sm text-body">
          Your tasks and deliverables — drag a card between columns to update it.
        </p>
      </div>
      <KanbanBoard items={items} canReopen={isSuperAdmin(user)} taskDetailBase="/staff/tasks" />
    </div>
  )
}
