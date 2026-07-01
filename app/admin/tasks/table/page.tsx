import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { WorkTable, type WorkGroup, type WorkRow } from './work-table'

export const dynamic = 'force-dynamic'

type RawTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  assigned_to: string | null
  parent_task_id: string | null
  position: number | null
  created_at: string
  client: { id: string; firm_name: string } | null
}

export default async function WorkTablePage() {
  const supa = createAdminClient()
  const [{ data: rawTasks }, { data: staff }] = await Promise.all([
    supa
      .from('tasks')
      .select(
        'id, task_number, title, status, priority, start_date, due_date, assigned_to, parent_task_id, position, created_at, client:clients(id, firm_name)'
      )
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1000)
      .returns<RawTask[]>(),
    supa
      .from('profiles')
      .select('id, full_name, is_active')
      .in('role', ['agency_staff', 'super_admin'])
      .eq('is_active', true)
      .order('full_name')
      .returns<{ id: string; full_name: string | null; is_active: boolean }[]>(),
  ])

  const tasks = rawTasks ?? []
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const toRow = (t: RawTask): WorkRow => ({
    id: t.id,
    task_number: t.task_number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    start_date: t.start_date,
    due_date: t.due_date,
    assigned_to: t.assigned_to,
    subtasks: [],
  })

  // Assemble the one-level tree: children attach to their parent; a child
  // whose parent isn't in the result set is promoted to top level.
  const rowById = new Map(tasks.map((t) => [t.id, toRow(t)]))
  const topLevel: RawTask[] = []
  for (const t of tasks) {
    if (t.parent_task_id && byId.has(t.parent_task_id)) {
      rowById.get(t.parent_task_id)!.subtasks.push(rowById.get(t.id)!)
    } else {
      topLevel.push(t)
    }
  }
  for (const t of tasks) {
    rowById.get(t.id)!.subtasks.sort((a, b) => {
      const pa = byId.get(a.id)?.position ?? 0
      const pb = byId.get(b.id)?.position ?? 0
      return pa - pb
    })
  }

  // Group top-level tasks by client, alphabetical; internal work last.
  const groupMap = new Map<string, WorkGroup>()
  for (const t of topLevel) {
    const key = t.client?.id ?? 'internal'
    const label = t.client?.firm_name ?? 'Internal'
    const g = groupMap.get(key) ?? { key, label, rows: [] }
    g.rows.push(rowById.get(t.id)!)
    groupMap.set(key, g)
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.key === 'internal') return 1
    if (b.key === 'internal') return -1
    return a.label.localeCompare(b.label)
  })

  const staffList = (staff ?? [])
    .filter((p) => p.full_name)
    .map((p) => ({ id: p.id, name: p.full_name as string }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Work table</h1>
          <p className="mt-1 text-sm text-body">
            Everything grouped by client — expand a task to see its workflow steps, and edit
            assignee, status, and dates inline.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin/tasks" className="text-fg-brand hover:underline">List →</Link>
          <Link href="/admin/tasks/board" className="text-fg-brand hover:underline">Board →</Link>
        </div>
      </div>

      <WorkTable groups={groups} staff={staffList} taskBase="/admin/tasks" />
    </div>
  )
}
