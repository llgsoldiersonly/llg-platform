'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

// Triggers POST /api/dataforseo/refresh-client?clientId=...
// Backlinks-only (the route deliberately skips SERP/maps to stay inside
// serverless function time budget; full sweep belongs in the weekly cron).
export function RefreshDataforseoButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [details, setDetails] = useState<{
    new_rows_saved: number
    lost_rows_saved: number
  } | null>(null)

  function handleClick() {
    setError(null)
    setSuccess(null)
    setDetails(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/dataforseo/refresh-client?clientId=${clientId}`, {
          method: 'POST',
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json.error ?? `HTTP ${res.status}`)
          return
        }
        setDetails(json.backlinks)
        setSuccess(`Backlinks refreshed for ${json.client?.firm_name ?? 'client'}.`)
        // Force the page to re-render with fresh dfs_* data.
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={pending} size="sm" variant="secondary">
        {pending ? 'Refreshing… (~30-60s)' : 'Refresh DataForSEO now'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && (
        <p className="text-xs text-emerald-600">
          {success}
          {details ? (
            <> Saved {details.new_rows_saved} new + {details.lost_rows_saved} lost backlink rows.</>
          ) : null}
        </p>
      )}
    </div>
  )
}
