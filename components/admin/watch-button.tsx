'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toggleWatchTask } from '@/lib/actions/tasks'

// Watch/unwatch a task: watchers get bell notifications for status changes
// and comments. Optimistic flip, server verifies.
export function WatchButton({ taskId, initialWatching }: { taskId: string; initialWatching: boolean }) {
  const router = useRouter()
  const [watching, setWatching] = useState(initialWatching)
  const [pending, startTransition] = useTransition()

  function toggle() {
    setWatching((w) => !w)
    startTransition(async () => {
      const res = await toggleWatchTask(taskId)
      if (res.ok) setWatching(res.data.watching)
      else setWatching(initialWatching)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${
        watching
          ? 'border-border-brand bg-brand-soft/40 text-fg-brand'
          : 'border-border-default text-body hover:border-border-brand hover:text-fg-brand'
      }`}
      title={watching ? 'Stop getting notifications for this task' : 'Get notified on status changes and comments'}
    >
      {watching ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {watching ? 'Watching' : 'Watch'}
    </button>
  )
}
