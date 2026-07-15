'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setLeadClientDecision, type ClientDecision } from '@/lib/actions/intakes'

const OPTIONS: { value: ClientDecision; label: string; activeClass: string }[] = [
  { value: 'accepted', label: 'Accepted', activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'not_accepted', label: 'Not accepted', activeClass: 'border-red-400 bg-red-50 text-red-700' },
  { value: 'disengaged', label: 'Disengaged', activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
]

// The firm's verdict after reviewing a lead. One tap, changeable any time —
// the current choice stays highlighted.
export function LeadDecisionButtons({
  leadId,
  current,
  decidedAt,
}: {
  leadId: string
  current: string | null
  decidedAt: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(value: ClientDecision) {
    setError(null)
    startTransition(async () => {
      const res = await setLeadClientDecision(leadId, value)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-body-subtle">
        Your decision on this lead
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((o) => {
          const active = current === o.value
          return (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              onClick={() => decide(o.value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                active ? o.activeClass : 'border-border-default text-body hover:border-border-brand hover:text-heading'
              }`}
            >
              {o.label}
            </button>
          )
        })}
        {current && decidedAt && (
          <span className="text-xs text-body-subtle">set {decidedAt.slice(0, 10)}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-fg-danger">{error}</p>}
    </div>
  )
}
