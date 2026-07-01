'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addTaskComment, setTaskHours } from '@/lib/actions/tasks'

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
