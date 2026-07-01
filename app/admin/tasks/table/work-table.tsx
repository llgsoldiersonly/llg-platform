'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { updateTaskStatus, reassignTask, setTaskDates } from '@/lib/actions/tasks'

export type WorkRow = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  assigned_to: string | null
  subtasks: WorkRow[]
}

export type WorkGroup = {
  key: string
  label: string
  rows: WorkRow[]
}

type Staff = { id: string; name: string }

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'blocked', label: 'Paused' },
  { value: 'done', label: 'Submitted' },
]

const STATUS_TINT: Record<string, string> = {
  todo: 'bg-neutral-secondary-soft text-body',
  in_progress: 'bg-brand-softer text-fg-brand-strong',
  in_review: 'bg-brand-softer text-fg-brand-strong',
  blocked: 'bg-warning-soft text-fg-warning-strong',
  done: 'bg-success-soft text-fg-success-strong',
}

export function WorkTable({
  groups,
  staff,
  taskBase,
}: {
  groups: WorkGroup[]
  staff: Staff[]
  taskBase: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Groups start open, subtask lists start closed — like the Wrike tree.
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set())
  const [openTasks, setOpenTasks] = useState<Set<string>>(new Set())

  const totalOpen = useMemo(
    () =>
      groups.reduce(
        (n, g) =>
          n +
          g.rows.filter((r) => r.status !== 'done').length +
          g.rows.flatMap((r) => r.subtasks).filter((s) => s.status !== 'done').length,
        0
      ),
    [groups]
  )

  function toggleGroup(key: string) {
    setClosedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleTask(id: string) {
    setOpenTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok && res.error) setError(res.error.message)
      router.refresh()
    })
  }

  function changeStatus(row: WorkRow, status: string) {
    // Pausing asks why — same behavior as the kanban board.
    let reason: string | null = null
    if (status === 'blocked') {
      reason = window.prompt('Why is this paused? (what is it waiting on?)') ?? null
      if (reason === null) return
    }
    run(() =>
      updateTaskStatus(
        row.id,
        status as 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled',
        reason
      )
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-body">{totalOpen} open items</p>
        {error && <p className="text-sm text-fg-danger">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="w-44 px-3 py-3 text-left font-medium">Assignee</th>
              <th className="w-36 px-3 py-3 text-left font-medium">Status</th>
              <th className="w-36 px-3 py-3 text-left font-medium">Start</th>
              <th className="w-36 px-3 py-3 text-left font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {groups.map((g) => {
              const closed = closedGroups.has(g.key)
              const openCount = g.rows.filter((r) => r.status !== 'done').length
              return (
                <GroupRows
                  key={g.key}
                  group={g}
                  closed={closed}
                  openCount={openCount}
                  onToggle={() => toggleGroup(g.key)}
                  openTasks={openTasks}
                  onToggleTask={toggleTask}
                  staff={staff}
                  taskBase={taskBase}
                  pending={pending}
                  changeStatus={changeStatus}
                  reassign={(row, uid) => run(() => reassignTask(row.id, uid || null))}
                  setDates={(row, start, due) => run(() => setTaskDates(row.id, start, due))}
                />
              )
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-body">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRows({
  group,
  closed,
  openCount,
  onToggle,
  openTasks,
  onToggleTask,
  staff,
  taskBase,
  pending,
  changeStatus,
  reassign,
  setDates,
}: {
  group: WorkGroup
  closed: boolean
  openCount: number
  onToggle: () => void
  openTasks: Set<string>
  onToggleTask: (id: string) => void
  staff: Staff[]
  taskBase: string
  pending: boolean
  changeStatus: (row: WorkRow, status: string) => void
  reassign: (row: WorkRow, userId: string) => void
  setDates: (row: WorkRow, start: string | null, due: string | null) => void
}) {
  return (
    <>
      <tr className="bg-neutral-primary-soft">
        <td colSpan={5} className="px-4 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left font-semibold text-heading"
          >
            {closed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {group.label}
            <span className="font-normal text-body-subtle">
              {openCount} open · {group.rows.length} total
            </span>
          </button>
        </td>
      </tr>
      {!closed &&
        group.rows.map((row) => (
          <TaskRows
            key={row.id}
            row={row}
            depth={0}
            openTasks={openTasks}
            onToggleTask={onToggleTask}
            staff={staff}
            taskBase={taskBase}
            pending={pending}
            changeStatus={changeStatus}
            reassign={reassign}
            setDates={setDates}
          />
        ))}
    </>
  )
}

function TaskRows({
  row,
  depth,
  openTasks,
  onToggleTask,
  staff,
  taskBase,
  pending,
  changeStatus,
  reassign,
  setDates,
}: {
  row: WorkRow
  depth: number
  openTasks: Set<string>
  onToggleTask: (id: string) => void
  staff: Staff[]
  taskBase: string
  pending: boolean
  changeStatus: (row: WorkRow, status: string) => void
  reassign: (row: WorkRow, userId: string) => void
  setDates: (row: WorkRow, start: string | null, due: string | null) => void
}) {
  const hasSubs = row.subtasks.length > 0
  const open = openTasks.has(row.id)
  const done = row.status === 'done'
  const hot = row.priority === 'urgent' || row.priority === 'high'
  const doneSubs = row.subtasks.filter((s) => s.status === 'done').length

  return (
    <>
      <tr className={done ? 'opacity-60' : ''}>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 24 }}>
            {hasSubs ? (
              <button
                type="button"
                onClick={() => onToggleTask(row.id)}
                className="shrink-0 text-body-subtle hover:text-heading"
                aria-label={open ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="text-xs text-body-subtle">#{row.task_number}</span>
            <Link
              href={`${taskBase}/${row.id}`}
              className={`font-medium hover:text-fg-brand hover:underline ${done ? 'text-body-subtle line-through' : 'text-heading'}`}
            >
              {row.title}
            </Link>
            {hasSubs && (
              <span className="text-xs text-body-subtle">
                {doneSubs}/{row.subtasks.length}
              </span>
            )}
            {hot && !done && <Badge variant="destructive">{row.priority}</Badge>}
          </div>
        </td>
        <td className="px-3 py-2">
          <Select
            value={row.assigned_to ?? ''}
            onChange={(e) => reassign(row, e.target.value)}
            disabled={pending}
            className="w-full text-xs"
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </td>
        <td className="px-3 py-2">
          <Select
            value={row.status}
            onChange={(e) => changeStatus(row, e.target.value)}
            disabled={pending}
            className={`w-full text-xs ${STATUS_TINT[row.status] ?? ''}`}
            aria-label="Status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            defaultValue={row.start_date ?? ''}
            onBlur={(e) => {
              if ((e.target.value || null) !== row.start_date) setDates(row, e.target.value, row.due_date)
            }}
            disabled={pending}
            className="w-full rounded border border-border-default bg-bg-default px-2 py-1 text-xs text-heading"
            aria-label="Start date"
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            defaultValue={row.due_date ?? ''}
            onBlur={(e) => {
              if ((e.target.value || null) !== row.due_date) setDates(row, row.start_date, e.target.value)
            }}
            disabled={pending}
            className="w-full rounded border border-border-default bg-bg-default px-2 py-1 text-xs text-heading"
            aria-label="Due date"
          />
        </td>
      </tr>
      {hasSubs &&
        open &&
        row.subtasks.map((sub) => (
          <TaskRows
            key={sub.id}
            row={sub}
            depth={depth + 1}
            openTasks={openTasks}
            onToggleTask={onToggleTask}
            staff={staff}
            taskBase={taskBase}
            pending={pending}
            changeStatus={changeStatus}
            reassign={reassign}
            setDates={setDates}
          />
        ))}
    </>
  )
}
