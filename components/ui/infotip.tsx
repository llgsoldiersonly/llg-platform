'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

// Dependency-free tooltip that works on hover, keyboard focus, AND tap —
// native `title` attributes are invisible on phones and slow on desktop.
//
// Two shapes:
//   <InfoTip text="…" />            → a small ⓘ trigger (put next to labels)
//   <InfoTip text="…">{badge}</InfoTip> → wraps any element as the trigger
export function InfoTip({
  text,
  side = 'top',
  children,
}: {
  text: string
  side?: 'top' | 'bottom'
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={children ? undefined : text}
        onClick={(e) => {
          // Tap-to-toggle; never trigger card drags / row clicks underneath.
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        draggable={false}
        className="inline-flex cursor-help items-center border-0 bg-transparent p-0 text-body-subtle hover:text-fg-brand focus:outline-none"
      >
        {children ?? <Info className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-md border border-border-default bg-bg-default p-2 text-left text-xs font-normal normal-case tracking-normal text-body shadow-md ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
