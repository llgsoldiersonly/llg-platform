import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/ui/infotip'
import { WatchButton } from './watch-button'
import { titleFromUrl } from '@/lib/title-from-url'
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
  recur_every: string | null
  client: { firm_name: string } | null
  department: { name: string } | null
  assigneeName: string | null
}

const RECUR_LABEL: Record<string, string> = {
  daily: 'daily',
  weekly: 'weekly',
  biweekly: 'every 2 weeks',
  monthly: 'monthly',
}
export type ActivityRow = { id: string; action: string; created_at: string; actorName: string | null }
export type CommentRow = { id: string; body: string; created_at: string; authorName: string | null }
export type SubtaskRow = { id: string; task_number: number; title: string; status: string; assigneeName: string | null }
export type TaskFileRow = { id: string; file_name: string; content_type: string | null; size_bytes: number | null; created_at: string }
export type ClientContext = {
  firmName: string
  sites: { domain: string; label: string | null; is_primary: boolean }[]
  recentSubmissions: { kind: string; title: string | null; link_url: string | null; created_at: string }[]
}

const statusVariant: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  todo: 'secondary', in_progress: 'info', in_review: 'info', blocked: 'warning', done: 'success', cancelled: 'secondary',
}
const statusLabel: Record<string, string> = {
  todo: 'To do', in_progress: 'In progress', in_review: 'In review', blocked: 'Paused', done: 'Submitted', cancelled: 'Cancelled',
}

// Highlight @Name tokens that match a known staff name.
function renderWithMentions(text: string, names: string[]): React.ReactNode {
  if (names.length === 0) return text
  const escaped = [...names]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`@(?:${escaped.join('|')})`, 'g')
  const out: React.ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <span key={key++} className="font-medium text-fg-brand">
        {m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
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
  mentionables,
  clientContext,
  submitPrefill,
  watchers = [],
  viewerId = null,
  taskBase,
  backHref,
}: {
  task: TaskDetailData
  activity: ActivityRow[]
  comments: CommentRow[]
  subtasks: SubtaskRow[]
  templates: { id: string; name: string }[]
  files: TaskFileRow[]
  mentionables: { id: string; name: string }[]
  clientContext: ClientContext | null
  submitPrefill?: { clientId: string; kind: string | null; deliverableId: string | null } | null
  watchers?: { id: string; name: string | null }[]
  viewerId?: string | null
  taskBase: string
  backHref: string
}) {
  const hot = task.priority === 'urgent' || task.priority === 'high'
  const doneSubs = subtasks.filter((s) => s.status === 'done').length

  // Staff portal only: deep-link into the prefilled submit form. Admins have
  // their own submissions surface.
  const submitHref =
    taskBase.startsWith('/staff') && submitPrefill
      ? `/staff?client=${submitPrefill.clientId}${submitPrefill.kind ? `&kind=${submitPrefill.kind}` : ''}${submitPrefill.deliverableId ? `&deliverable=${submitPrefill.deliverableId}` : ''}#submit`
      : null
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
          {viewerId && (
            <span className="ml-auto flex items-center gap-2">
              {watchers.length > 0 && (
                <InfoTip text={`Watching: ${watchers.map((w) => w.name ?? 'Unknown').join(', ')}`}>
                  <span className="text-xs text-body-subtle">
                    {watchers.length} watcher{watchers.length === 1 ? '' : 's'}
                  </span>
                </InfoTip>
              )}
              <WatchButton taskId={task.id} initialWatching={watchers.some((w) => w.id === viewerId)} />
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-heading">{task.title}</h1>
        {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-body">{task.description}</p>}
        {submitHref && (
          <Link
            href={submitHref}
            className="mt-3 inline-flex items-center rounded-md border border-border-brand px-3 py-1.5 text-sm font-medium text-fg-brand hover:bg-brand-soft/40"
          >
            Submit work for this task →
          </Link>
        )}
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
          {task.recur_every && (
            <Field label="Repeats">
              <InfoTip text="When this task is Submitted, the next occurrence is created automatically — same assignee, due one interval later (never in the past).">
                <span>{RECUR_LABEL[task.recur_every] ?? task.recur_every} 🔁</span>
              </InfoTip>
            </Field>
          )}
          {task.status === 'blocked' && <Field label="Paused — reason">{task.block_reason ?? '—'}</Field>}
        </CardContent>
      </Card>

      {clientContext && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Client context — {clientContext.firmName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-body-subtle">Websites</p>
              {clientContext.sites.length === 0 ? (
                <p className="mt-1 text-sm text-body-subtle">No tracked sites.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {clientContext.sites.map((s) => (
                    <li key={s.domain}>
                      <a
                        href={`https://${s.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg-brand hover:underline"
                      >
                        {s.domain}
                      </a>
                      <span className="text-xs text-body-subtle">
                        {s.is_primary ? ' · primary' : ''}
                        {s.label ? ` · ${s.label}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-body-subtle">Recent work for this client</p>
              {clientContext.recentSubmissions.length === 0 ? (
                <p className="mt-1 text-sm text-body-subtle">No submissions yet.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {clientContext.recentSubmissions.map((s, i) => (
                    <li key={i} className="truncate">
                      {s.link_url ? (
                        <a href={s.link_url} target="_blank" rel="noreferrer" className="text-fg-brand hover:underline">
                          {s.title || titleFromUrl(s.link_url) || s.link_url}
                        </a>
                      ) : (
                        <span className="text-heading">{s.title ?? s.kind}</span>
                      )}
                      <span className="text-xs text-body-subtle"> · {s.kind} · {s.created_at.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="inline-flex items-center gap-1.5 text-base">
            Subtasks {subtasks.length > 0 && <span className="text-body-subtle">({doneSubs}/{subtasks.length})</span>}
            <InfoTip text="The task's workflow steps. Applying a workflow spawns one subtask per step — each step's assignee is notified automatically when the previous one is finished." />
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
          <CardTitle className="inline-flex items-center gap-1.5 text-base">
            Hours
            <InfoTip text="Estimated = how long you expect it to take (this drives the Workload capacity bars). Actual = what it really took, filled in as you go or when finished." />
          </CardTitle>
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
          <TaskCommentForm taskId={task.id} mentionables={mentionables} />
          {comments.length > 0 && (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded border border-border-default p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-heading">{c.authorName ?? 'Staff'}</span>
                    <span className="text-xs text-body-subtle">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-body">
                    {renderWithMentions(c.body, mentionables.map((m) => m.name))}
                  </p>
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
