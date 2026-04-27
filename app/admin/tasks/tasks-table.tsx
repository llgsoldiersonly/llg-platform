'use client'

import { useTransition, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'

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

const statusVariant: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  todo: 'secondary',
  in_progress: 'info',
  in_review: 'info',
  blocked: 'destructive',
  done: 'success',
  cancelled: 'secondary',
}

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled']

export function TasksTable({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">
          No tasks yet. Create one with the button above, or convert a deliverable into a task from the client deliverables page.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Task</th>
              <th className="px-6 py-3 text-left font-medium">Client</th>
              <th className="px-6 py-3 text-left font-medium">Assignee</th>
              <th className="px-6 py-3 text-left font-medium">Due</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <Row key={t.id} task={t} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function Row({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function changeStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setError(null)
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, next as 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled')
      if (!result.ok) setError(result.error.message)
    })
  }

  function onDelete() {
    if (!confirm('Delete this task?')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (!result.ok) setError(result.error.message)
    })
  }

  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done' && task.status !== 'cancelled'

  return (
    <tr className={overdue ? 'bg-red-50/30' : ''}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">#{task.task_number}</span>
          <span className="font-medium text-slate-900">{task.title}</span>
          {task.priority === 'urgent' && <Badge variant="destructive">URGENT</Badge>}
          {task.priority === 'high' && <Badge variant="warning">High</Badge>}
        </div>
        {task.department && (
          <p className="mt-1 text-xs text-slate-500">{task.department.name}</p>
        )}
      </td>
      <td className="px-6 py-4 text-slate-600">
        {task.client?.firm_name ?? <span className="text-slate-400">internal</span>}
      </td>
      <td className="px-6 py-4 text-slate-600">
        {task.assignee?.full_name ?? <span className="text-slate-400">unassigned</span>}
      </td>
      <td className={`px-6 py-4 text-xs ${overdue ? 'font-medium text-red-700' : 'text-slate-600'}`}>
        {task.due_date ?? '—'}
      </td>
      <td className="px-6 py-4">
        <Select
          value={task.status}
          onChange={changeStatus}
          disabled={isPending}
          className="w-32 text-xs"
          aria-label="Update status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-6 py-4 text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={isPending}
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  )
}
