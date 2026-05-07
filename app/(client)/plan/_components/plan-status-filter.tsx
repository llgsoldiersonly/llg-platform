'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Complete' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
] as const

// URL-driven filter so it survives nav and is shareable. Reads ?status=,
// renders Links that overwrite that one param. Visual style mirrors the
// existing pill/chip language (border-border-default + brand-soft active
// fill) — no new design tokens.
export function PlanStatusFilter() {
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

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="mr-1 text-xs uppercase tracking-wide text-body">Status</span>
      {STATUS_OPTIONS.map((opt) => {
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
