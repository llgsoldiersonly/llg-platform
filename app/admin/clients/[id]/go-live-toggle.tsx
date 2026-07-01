'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Rocket } from 'lucide-react'
import { setClientLive } from '@/lib/actions/clients'

// Flips the client's site between pre-launch and live (drives the portal's
// pre-launch → live view via clients.status). Live = 'active', pre-launch =
// 'onboarding'.
export function GoLiveToggle({ clientId, isLive }: { clientId: string; isLive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [live, setLive] = useState(isLive)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    const next = !live
    setLive(next) // optimistic
    startTransition(async () => {
      const res = await setClientLive(clientId, next)
      if (!res.ok) {
        setLive(!next)
        setError(res.error.message)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={live ? 'success' : 'secondary'}>{live ? 'Live' : 'Pre-launch'}</Badge>
        <Button
          type="button"
          size="sm"
          variant={live ? 'outline' : 'default'}
          disabled={pending}
          onClick={toggle}
        >
          <Rocket className="h-4 w-4" />
          {pending ? 'Saving…' : live ? 'Revert to pre-launch' : 'Set site live'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
