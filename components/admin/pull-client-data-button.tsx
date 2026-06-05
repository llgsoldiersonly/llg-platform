'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

type RefreshResults = {
  sites_processed: number
  backlink_rows: number
  site_health_audits: number
  gbp_locations: number
  calls: number
}

// Triggers POST /api/admin/refresh-client-data — runs the per-client crons
// (backlinks + site health per site, GBP per location, CallRail) on demand so
// a freshly-created client's data isn't blank until the scheduled runs.
export function PullClientDataButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RefreshResults | null>(null)
  const [issues, setIssues] = useState<Array<{ stage: string; message: string }>>([])

  function handleClick() {
    setError(null)
    setResults(null)
    setIssues([])
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/refresh-client-data?clientId=${clientId}`, {
          method: 'POST',
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json.error ?? `HTTP ${res.status}`)
          return
        }
        setResults(json.results)
        setIssues(json.errors ?? [])
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={pending} size="sm" variant="secondary">
        <RefreshCw className="h-4 w-4" />
        {pending ? 'Pulling… (up to ~2 min)' : 'Pull latest data'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {results && (
        <p className="text-xs text-emerald-600">
          Site health: {results.site_health_audits} · GBP: {results.gbp_locations} · Calls:{' '}
          {results.calls} · Backlinks: {results.backlink_rows} rows
        </p>
      )}
      {issues.length > 0 && (
        <p className="text-xs text-amber-600">
          {issues.length} skipped: {issues[0].stage} — {issues[0].message}
          {issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}
        </p>
      )}
    </div>
  )
}
