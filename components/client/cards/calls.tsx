'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { deriveStatusFromTags, primaryTag, type CallStatus } from '@/lib/calls/status'

export type CallRow = {
  id: string
  caller_name: string | null
  caller_number: string | null
  tags: string[] | null
  started_at: string | null
}

type Tab = 'pending' | 'accepted' | 'rejected'

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const STATUS_BADGE: Record<CallStatus, { variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive'; label: string }> = {
  accepted: { variant: 'success', label: 'Accepted' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  pending: { variant: 'info', label: 'Pending' },
  unknown: { variant: 'secondary', label: '—' },
}

function formatPhone(raw: string | null): string {
  if (!raw) return '—'
  // Crude formatting: +1xxxxxxxxxx → +1 (xxx) xxx-xxxx
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

export function CallsCard({ calls }: { calls: CallRow[] }) {
  // Pre-compute status for each row once; tabs filter on the cached value.
  const enriched = useMemo(
    () =>
      calls.map((c) => ({
        ...c,
        status: deriveStatusFromTags(c.tags),
        primary_tag: primaryTag(c.tags),
      })),
    [calls]
  )

  const counts = useMemo(() => {
    const acc = { pending: 0, accepted: 0, rejected: 0 }
    for (const c of enriched) {
      if (c.status === 'pending' || c.status === 'accepted' || c.status === 'rejected') {
        acc[c.status] += 1
      }
    }
    return acc
  }, [enriched])

  // Default to the tab with the most cases — usually Pending in active funnels,
  // but if Accepted is dominant (good problem) or Rejected, surface that first.
  const initialTab: Tab = useMemo(() => {
    if (counts.pending > 0) return 'pending'
    if (counts.accepted > 0) return 'accepted'
    return 'rejected'
  }, [counts])

  const [tab, setTab] = useState<Tab>(initialTab)
  const visible = enriched.filter((c) => c.status === tab).slice(0, 30)

  if (enriched.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-body">
            No tracked calls yet. New calls show up here within 24 hours of being received.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-fg-brand" />
          <CardTitle className="text-lg">Calls</CardTitle>
        </div>
        <div role="tablist" aria-label="Filter calls by status" className="flex items-center gap-1 rounded-md border border-border-default bg-neutral-secondary-soft p-1 text-xs">
          {(['pending', 'accepted', 'rejected'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded px-3 py-1.5 transition ${
                tab === t ? 'bg-bg-default font-semibold text-fg-brand-strong shadow-sm' : 'text-body'
              }`}
            >
              {TAB_LABEL[t]}
              <span className="ml-1.5 text-body-subtle">{counts[t]}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {visible.length === 0 ? (
          <p className="p-6 text-sm text-body">No {TAB_LABEL[tab].toLowerCase()} calls in your recent history.</p>
        ) : (
          <ul className="divide-y divide-border-light">
            {visible.map((c) => {
              const statusInfo = STATUS_BADGE[c.status]
              return (
                <li key={c.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-heading">
                      {c.caller_name?.trim() || 'Unknown caller'}
                    </div>
                    <div className="text-xs text-body">
                      {formatPhone(c.caller_number)}
                      {c.primary_tag && <> · {c.primary_tag}</>}
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  <div className="hidden text-xs text-body-subtle sm:block min-w-[88px] text-right" title={c.started_at ? format(new Date(c.started_at), 'PPpp') : ''}>
                    {c.started_at ? formatDistanceToNow(new Date(c.started_at), { addSuffix: true }) : '—'}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
