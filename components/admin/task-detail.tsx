import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TaskHoursForm, TaskCommentForm, AddSubtaskForm, ApplyTemplateForm, TaskFiles } from './task-detail-forms'

export type TaskDetailData = {
  id: string
  task_number: number
  title: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  block_reason: string | null
  estimated_hours: number | null
  actual_hours: number | null
  client: { firm_name: string } | null
  department: { name: string } | null
  assigneeName: string | null
}
export type ActivityRow = { id: string; action: string; created_at: string; actorName: string | null }
export type CommentRow = { id: string; body: string; created_at: string; authorName: string | null }
export type SubtaskRow = { id: string; task_number: number; title: string; status: string; assigneeName: string | null }
export type TaskFileRow = { id: string; file_name: string; content_type: string | null; size_bytes: number | null; created_at: string }

const statusVariant: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  todo: 'secondary', in_progress: 'info', in_review: 'info', blocked: 'warning', done: 'success', cancelled: 'secondary',
}
const statusLabel: Record<string, string> = {
  todo: 'To do', in_progress: 'In progress', in_review: 'In review', blocked: 'Paused', done: 'Submitted', cancelled: 'Cancelled',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-body-subtle">{label}</p>
      <p className="text-sm text-heading">{children}</p>
    </div>
  )
}

export function TaskDetail({
  task,
  activity,
  comments,
  subtasks,
  templates,
  files,
  taskBase,
  backHref,
}: {
  task: TaskDetailData
  activity: ActivityRow[]
  comments: CommentRow[]
  subtasks: SubtaskRow[]
  templates: { id: string; name: string }[]
  files: TaskFileRow[]
  taskBase: string
  backHref: string
}) {
  const hot = task.priority === 'urgent' || task.priority === 'high'
  const doneSubs = subtasks.filter((s) => s.status === 'done').length
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-body-subtle hover:text-body">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-body-subtle">#{task.task_number}</span>
          <Badge variant={statusVariant[task.status] ?? 'secondary'}>{statusLabel[task.status] ?? task.status}</Badge>
          {hot && <Badge variant="destructive">{task.priority}</Badge>}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-heading">{task.title}</h1>
        {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-body">{task.description}</p>}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <Field label="Client">{task.client?.firm_name ?? 'internal'}</Field>
          <Field label="Department">{task.department?.name ?? '—'}</Field>
          <Field label="Assignee">{task.assigneeName ?? 'unassigned'}</Field>
          <Field label="Timeline">
            {task.start_date || task.due_date
              ? `${task.start_date ?? '—'} → ${task.due_date ?? '—'}`
              : '—'}
          </Field>
          <Field label="Priority">{task.priority}</Field>
          {task.status === 'blocked' && <Field label="Paused — reason">{task.block_reason ?? '—'}</Field>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            Subtasks {subtasks.length > 0 && <span className="text-body-subtle">({doneSubs}/{subtasks.length})</span>}
          </CardTitle>
          <ApplyTemplateForm taskId={task.id} templates={templates} />
        </CardHeader>
        <CardContent className="space-y-3">
          {subtasks.length > 0 && (
            <ul className="divide-y divide-border-light rounded border border-border-default">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <Link
                    href={`${taskBase}/${s.id}`}
                    className={`text-sm hover:text-fg-brand hover:underline ${s.status === 'done' ? 'text-body-subtle line-through' : 'text-heading'}`}
                  >
                    {s.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.assigneeName && <span className="text-xs text-body">{s.assigneeName}</span>}
                    <Badge variant={statusVariant[s.status] ?? 'secondary'}>{statusLabel[s.status] ?? s.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AddSubtaskForm parentId={task.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Files {files.length > 0 && <span className="text-body-subtle">({files.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskFiles taskId={task.id} files={files} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskHoursForm taskId={task.id} estimated={task.estimated_hours} actual={task.actual_hours} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comments ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskCommentForm taskId={task.id} />
          {comments.length > 0 && (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded border border-border-default p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-heading">{c.authorName ?? 'Staff'}</span>
                    <span className="text-xs text-body-subtle">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-body">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-body-subtle">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-body">
                  <span>
                    <span className="font-medium text-heading">{a.actorName ?? 'Someone'}</span> {a.action}
                  </span>
                  <span className="text-xs text-body-subtle">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
