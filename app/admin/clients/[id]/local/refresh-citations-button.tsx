'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { refreshClientCitations } from '@/lib/actions/citations'

// Pulls BrightLocal Citation Tracker results for this client (or requests a
// report if none exists yet). BrightLocal crawls asynchronously, so the first
// click usually "requests" and a later click "updates".
export function RefreshCitationsButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function handleClick() {
    setMsg(null)
    startTransition(async () => {
      const res = await refreshClientCitations(clientId)
      if (res.ok) {
        setIsError(false)
        setMsg(res.data.message)
        if (res.data.status === 'updated') router.refresh()
      } else {
        setIsError(true)
        setMsg(res.error.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={pending} size="sm" variant="secondary">
        <RefreshCw className="h-4 w-4" />
        {pending ? 'Pulling…' : 'Pull BrightLocal citations'}
      </Button>
      {msg && (
        <p className={`max-w-md text-right text-xs ${isError ? 'text-red-600' : 'text-emerald-600'}`}>
          {msg}
        </p>
      )}
    </div>
  )
}
