'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Image as ImageIcon, Video, FileSpreadsheet, File as FileIcon, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addTaskComment, setTaskHours, addSubtask } from '@/lib/actions/tasks'
import { applyTemplateToTask } from '@/lib/actions/task-templates'
import { uploadTaskFile, deleteTaskFile } from '@/lib/actions/task-files'

export function TaskHoursForm({
  taskId,
  estimated,
  actual,
}: {
  taskId: string
  estimated: number | null
  actual: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [est, setEst] = useState(estimated?.toString() ?? '')
  const [act, setAct] = useState(actual?.toString() ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const res = await setTaskHours(
        taskId,
        est.trim() === '' ? null : Number(est),
        act.trim() === '' ? null : Number(act)
      )
      if (res.ok) {
        setMsg('Saved')
        router.refresh()
      } else setMsg(res.error.message)
    })
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-body">Estimated hrs</label>
        <Input type="number" step="0.25" min="0" value={est} onChange={(e) => setEst(e.target.value)} className="w-28" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-body">Actual hrs</label>
        <Input type="number" step="0.25" min="0" value={act} onChange={(e) => setAct(e.target.value)} className="w-28" />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save hours'}
      </Button>
      {msg && <span className="text-xs text-body-subtle">{msg}</span>}
    </form>
  )
}

export function AddSubtaskForm({ parentId }: { parentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addSubtask(parentId, title)
      if (res.ok) {
        setTitle('')
        router.refresh()
      } else setError(res.error.message)
    })
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a subtask…"
        className="flex-1"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || !title.trim()}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}

export function ApplyTemplateForm({
  taskId,
  templates,
}: {
  taskId: string
  templates: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [templateId, setTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (templates.length === 0) return null

  function apply() {
    if (!templateId) return
    setError(null)
    startTransition(async () => {
      const res = await applyTemplateToTask(taskId, templateId)
      if (res.ok) {
        setTemplateId('')
        router.refresh()
      } else setError(res.error.message)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        className="w-56 text-sm"
        aria-label="Apply a workflow template"
      >
        <option value="">Apply a workflow…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>
      <Button type="button" size="sm" variant="outline" onClick={apply} disabled={pending || !templateId}>
        {pending ? 'Adding…' : 'Add steps'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

type TaskFile = {
  id: string
  file_name: string
  content_type: string | null
  size_bytes: number | null
  created_at: string
}

function isImage(f: TaskFile): boolean {
  return (f.content_type ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.file_name)
}

function fileIcon(f: TaskFile) {
  const name = f.file_name.toLowerCase()
  const ct = f.content_type ?? ''
  if (isImage(f)) return ImageIcon
  if (ct.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(name)) return Video
  if (/\.(csv|xlsx?)$/.test(name)) return FileSpreadsheet
  if (ct === 'application/pdf' || /\.(pdf|docx?|txt)$/.test(name)) return FileText
  return FileIcon
}

function humanSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskFiles({ taskId, files }: { taskId: string; files: TaskFile[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const fd = new FormData()
    fd.set('task_id', taskId)
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadTaskFile(fd)
      if (!res.ok) setError(res.error.message)
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    })
  }

  function onDelete(fileId: string) {
    if (!confirm('Remove this attachment?')) return
    setError(null)
    startTransition(async () => {
      const res = await deleteTaskFile(fileId, taskId)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const Icon = fileIcon(f)
            const viewUrl = `/api/task-files/${f.id}/download`
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded border border-border-default p-2"
              >
                {isImage(f) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewUrl}
                    alt={f.file_name}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-neutral-secondary-soft">
                    <Icon className="h-5 w-5 text-body" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-heading hover:text-fg-brand hover:underline"
                  >
                    {f.file_name}
                  </a>
                  <span className="text-xs text-body-subtle">{humanSize(f.size_bytes)}</span>
                </div>
                <a
                  href={`${viewUrl}?dl=1`}
                  className="text-body-subtle hover:text-fg-brand"
                  aria-label="Download"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  disabled={pending}
                  className="text-body-subtle hover:text-fg-danger disabled:opacity-50"
                  aria-label="Remove attachment"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          onChange={onPick}
          disabled={pending}
          accept="image/*,video/*,.pdf,.doc,.docx,.csv,.xls,.xlsx,.txt"
          className="block w-full text-sm text-body file:mr-3 file:rounded-md file:border-0 file:bg-neutral-secondary-soft file:px-3 file:py-1.5 file:text-sm file:text-heading hover:file:bg-neutral-tertiary-soft"
        />
        {pending && <span className="shrink-0 text-xs text-body-subtle">Uploading…</span>}
      </div>
      <p className="text-xs text-body-subtle">Images, video, PDF, Word, CSV, or Excel — up to 200MB.</p>
      {error && <p className="text-sm text-fg-danger">{error}</p>}
    </div>
  )
}

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addTaskComment(taskId, body)
      if (res.ok) {
        setBody('')
        router.refresh()
      } else setError(res.error.message)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        rows={2}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? 'Posting…' : 'Comment'}
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  )
}
