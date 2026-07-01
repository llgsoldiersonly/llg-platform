'use client'

import { useTransition, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, RotateCcw, Search } from 'lucide-react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'

type Task = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  created_at: string
  client: { id: string; firm_name: string } | null
  department: { name: string; slug: string } | null
  assignee: { id: string; full_name: string | null } | null
}

// Active-only options; completed tasks use the Reopen control instead.
const ACTIVE_STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']
const isClosed = (s: string) => s === 'done' || s === 'cancelled'

function fmtTimeline(start: string | null, due: string | null): string {
  if (start && due) return `${start} → ${due}`
  if (due) return due
  if (start) return `${start} → —`
  return '—'
}

export function TasksTable({ tasks, canReopen = false }: { tasks: Task[]; canReopen?: boolean }) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return tasks
    return tasks.filter((t) =>
      [
        `#${t.task_number}`,
        t.title,
        t.client?.firm_name ?? '',
        t.assignee?.full_name ?? '',
        t.department?.name ?? '',
        t.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [tasks, q])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks (incl. completed)…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-body">
            {tasks.length === 0
              ? 'No tasks yet. Create one with the button above.'
              : 'No tasks match your search.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Task</th>
                  <th className="px-6 py-3 text-left font-medium">Client</th>
                  <th className="px-6 py-3 text-left font-medium">Assignee</th>
                  <th className="px-6 py-3 text-left font-medium">Timeline</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filtered.map((t) => (
                  <Row key={t.id} task={t} canReopen={canReopen} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ task, canReopen }: { task: Task; canReopen: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const closed = isClosed(task.status)

  function changeStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setError(null)
    startTransition(async () => {
      const result = await updateTaskStatus(
        task.id,
        next as 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled'
      )
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  function reopen() {
    setError(null)
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, 'in_progress')
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  function onDelete() {
    if (!confirm('Delete this task?')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  const overdue = task.due_date && new Date(task.due_date) < new Date() && !closed

  return (
    <tr className={closed ? 'bg-neutral-secondary-soft/40 opacity-60' : overdue ? 'bg-danger-soft/30' : ''}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-body">#{task.task_number}</span>
          <Link
            href={`/admin/tasks/${task.id}`}
            className={`font-medium text-heading hover:text-fg-brand hover:underline ${closed ? 'line-through' : ''}`}
          >
            {task.title}
          </Link>
          {!closed && task.priority === 'urgent' && <Badge variant="destructive">URGENT</Badge>}
          {!closed && task.priority === 'high' && <Badge variant="warning">High</Badge>}
        </div>
        {task.department && <p className="mt-1 text-xs text-body">{task.department.name}</p>}
      </td>
      <td className="px-6 py-4 text-body">
        {task.client?.firm_name ?? <span className="text-body-subtle">internal</span>}
      </td>
      <td className="px-6 py-4 text-body">
        {task.assignee?.full_name ?? <span className="text-body-subtle">unassigned</span>}
      </td>
      <td className={`px-6 py-4 text-xs ${overdue ? 'font-medium text-fg-danger-strong' : 'text-body'}`}>
        {fmtTimeline(task.start_date, task.due_date)}
      </td>
      <td className="px-6 py-4">
        {closed ? (
          <Badge variant="secondary">{task.status === 'done' ? 'Completed' : 'Cancelled'}</Badge>
        ) : (
          <Select
            value={task.status}
            onChange={changeStatus}
            disabled={isPending}
            className="w-32 text-xs"
            aria-label="Update status"
          >
            {ACTIVE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {closed && canReopen && (
            <Button variant="outline" size="sm" onClick={reopen} disabled={isPending}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isPending}
            aria-label="Delete task"
          >
            <Trash2 className="h-4 w-4 text-body-subtle hover:text-fg-danger" />
          </Button>
        </div>
        {error && <p className="text-xs text-fg-danger">{error}</p>}
      </td>
    </tr>
  )
}
