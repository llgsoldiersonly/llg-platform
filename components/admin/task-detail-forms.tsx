'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addTaskComment, setTaskHours, addSubtask } from '@/lib/actions/tasks'
import { applyTemplateToTask } from '@/lib/actions/task-templates'

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
