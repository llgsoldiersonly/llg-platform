'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const DISMISS_KEY = 'llg-staff-help-intro-dismissed'

// One-time "new here?" pointer to the help page. Dismissal is per-browser
// (localStorage) — deliberately not server state, it's just a signpost.
export function HelpIntroCard() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setShow(true)
    } catch {
      // storage unavailable → skip quietly
    }
  }, [])

  if (!show) return null

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border-brand/60 bg-brand-soft/30 p-3 text-sm">
      <p className="text-body">
        <span className="font-medium text-heading">New here?</span>{' '}
        <Link href="/staff/help" className="text-fg-brand underline">
          How your workspace works
        </Link>{' '}
        explains tasks vs. steps, statuses, and how to submit work — a 3-minute read.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1')
          } catch { /* ignore */ }
          setShow(false)
        }}
        className="shrink-0 text-body-subtle hover:text-heading"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
