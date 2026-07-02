'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle2, Paperclip, RotateCcw } from 'lucide-react'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { submitDeliverableProof } from '@/lib/actions/submissions'

// One-tap actions on My Day cards, so common moves don't require opening the
// task or dragging on the board (also the mobile-friendly path).
export function WorkItemQuickActions({
  kind,
  id,
  status,
}: {
  kind: 'task' | 'deliverable'
  id: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok && res.error) setError(res.error.message)
      router.refresh()
    })
  }

  function addProof() {
    const url = window.prompt('Paste the URL that proves this deliverable is done:')
    if (url === null) return
    const trimmed = url.trim()
    if (!trimmed) return
    run(() => submitDeliverableProof(id, trimmed))
  }

  const btn =
    'inline-flex items-center gap-1 rounded border border-border-default px-2 py-0.5 text-xs text-body hover:border-border-brand hover:text-fg-brand disabled:opacity-50'

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {kind === 'task' && status === 'todo' && (
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => updateTaskStatus(id, 'in_progress'))}>
          <Play className="h-3 w-3" /> Start
        </button>
      )}
      {kind === 'task' && status === 'in_progress' && (
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => updateTaskStatus(id, 'in_review'))}>
          <CheckCircle2 className="h-3 w-3" /> Ready for review
        </button>
      )}
      {kind === 'task' && status === 'blocked' && (
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => updateTaskStatus(id, 'in_progress'))}>
          <RotateCcw className="h-3 w-3" /> Resume
        </button>
      )}
      {kind === 'deliverable' && (status === 'pending' || status === 'in_progress') && (
        <button type="button" className={btn} disabled={pending} onClick={addProof}>
          <Paperclip className="h-3 w-3" /> Add proof
        </button>
      )}
      {error && <span className="text-xs text-fg-danger">{error}</span>}
    </div>
  )
}
