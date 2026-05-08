'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type Counts = { all: number; open: number; closed: number }

// URL-driven filter chips (?status=all|open|closed). Mirrors the plan
// page's PlanStatusFilter idiom; styled with the existing brand-soft +
// border-default tokens — no new design tokens.
export function TicketsStatusFilter({ counts }: { counts: Counts }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get('status') ?? 'all'

  const buildHref = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const options = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'closed', label: `Closed (${counts.closed})` },
  ] as const

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {options.map((opt) => {
        const active = opt.value === current
        return (
          <Link
            key={opt.value}
            href={buildHref(opt.value)}
            scroll={false}
            className={cn(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              active
                ? 'border-border-brand-subtle bg-brand-softer text-fg-brand-strong'
                : 'border-border-default bg-transparent text-body hover:bg-neutral-secondary-soft',
            )}
          >
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}
