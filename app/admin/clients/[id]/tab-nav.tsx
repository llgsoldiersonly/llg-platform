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
    <nav className="-mb-px flex gap-6 overflow-x-auto border-b border-slate-200">
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
                ? 'border-slate-900 font-medium text-slate-900'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
              upcoming && 'cursor-not-allowed text-slate-400 hover:border-transparent hover:text-slate-400'
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.phase && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
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
