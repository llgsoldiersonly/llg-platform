'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type Tab = { href: string; label: string; phase?: string }

export function ClientTabNav({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/admin/clients/${clientId}`

  const tabs: Tab[] = [
    { href: base,                          label: 'Summary' },
    { href: `${base}/deliverables`,        label: 'Deliverables' },
    { href: `${base}/credentials`,         label: 'Credentials' },
    { href: `${base}/content`,             label: 'Content' },
    { href: `${base}/calls`,               label: 'Calls' },
    { href: `${base}/social`,              label: 'Social' },
    { href: `${base}/ads`,                 label: 'Ads' },
    { href: `${base}/rankings`,            label: 'Rankings',     phase: 'Phase 7' },
    { href: `${base}/local`,               label: 'Local',        phase: 'Phase 8' },
    { href: `${base}/tickets`,             label: 'Tickets',      phase: 'global view exists' },
    { href: `${base}/tasks`,               label: 'Tasks',        phase: 'global view exists' },
  ]

  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto border-b border-border-default">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        const upcoming = !!tab.phase
        return (
          <Link
            key={tab.href}
            href={upcoming ? '#' : tab.href}
            aria-disabled={upcoming}
            onClick={(e) => upcoming && e.preventDefault()}
            className={cn(
              'whitespace-nowrap border-b-2 pb-3 pt-1 text-sm transition-colors',
              active
                ? 'border-heading font-medium text-heading'
                : 'border-transparent text-body hover:border-border-default-strong hover:text-heading',
              upcoming && 'cursor-not-allowed text-body-subtle hover:border-transparent hover:text-body-subtle'
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.phase && (
                <span className="rounded bg-neutral-tertiary-soft px-1.5 py-0.5 text-[10px] font-mono text-body">
                  {tab.phase}
                </span>
              )}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
