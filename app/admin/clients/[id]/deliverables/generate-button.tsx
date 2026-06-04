'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { generateDeliverablesForClient } from '@/lib/actions/clients'

// Runs the period rollover scoped to this client so a mid-month signup gets
// its package deliverables immediately, instead of waiting for the monthly
// cron. Idempotent — re-running only adds what's missing.
export function GenerateDeliverablesButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function handleClick() {
    setMsg(null)
    startTransition(async () => {
      const res = await generateDeliverablesForClient(clientId)
      if (res.ok) {
        setIsError(false)
        setMsg(
          res.data.created > 0
            ? `Added ${res.data.created} deliverable${res.data.created === 1 ? '' : 's'}.`
            : 'Already up to date for this period.'
        )
        router.refresh()
      } else {
        setIsError(true)
        setMsg(res.error.message)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className={isError ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>{msg}</span>
      )}
      <Button type="button" variant="secondary" onClick={handleClick} disabled={pending}>
        <RefreshCw className="h-4 w-4" />
        {pending ? 'Generating…' : 'Generate deliverables now'}
      </Button>
    </div>
  )
}
