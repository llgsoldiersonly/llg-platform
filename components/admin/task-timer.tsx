'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Square } from 'lucide-react'
import { startTaskTimer, stopTaskTimer } from '@/lib/actions/tasks'

function elapsedLabel(startedAt: string, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

// Start/stop timer on a task. Stopping adds the elapsed time to actual_hours
// (capped server-side at 8h so forgotten timers don't log a weekend).
export function TaskTimer({
  taskId,
  startedAt,
  startedByName,
  startedByViewer,
}: {
  taskId: string
  startedAt: string | null
  startedByName: string | null
  startedByViewer: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const running = !!startedAt

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  function start() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await startTaskTimer(taskId)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  function stop() {
    setError(null)
    startTransition(async () => {
      const res = await stopTaskTimer(taskId)
      if (res.ok) setNotice(`Logged ${res.data.loggedHours}h — actual is now ${res.data.actualHours}h.`)
      else setError(res.error.message)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!running ? (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-sm text-body hover:border-border-brand hover:text-fg-brand disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" /> Start timer
        </button>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-soft/40 px-3 py-1.5 text-sm font-medium tabular-nums text-fg-brand">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fg-brand opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fg-brand" />
            </span>
            {elapsedLabel(startedAt, now)}
            {!startedByViewer && startedByName && (
              <span className="font-normal text-body-subtle">· {startedByName}</span>
            )}
          </span>
          {(startedByViewer || startedByName) && (
            <button
              type="button"
              onClick={stop}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-sm text-body hover:border-border-danger hover:text-fg-danger disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" /> Stop &amp; log
            </button>
          )}
        </>
      )}
      {notice && <span className="text-xs text-fg-success-strong">{notice}</span>}
      {error && <span className="text-xs text-fg-danger">{error}</span>}
    </div>
  )
}
