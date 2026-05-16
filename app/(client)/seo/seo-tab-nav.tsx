'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type Tab = { href: string; label: string; phase?: string }

const tabs: Tab[] = [
  { href: '/seo',             label: 'Overview' },
  { href: '/seo/backlinks',   label: 'Backlinks' },
  { href: '/seo/rankings',    label: 'Rankings' },
  { href: '/seo/ai',          label: 'AI Visibility' },
  { href: '/seo/competitors', label: 'Competitors' },
  { href: '/seo/weekly',      label: 'Weekly Report' },
  { href: '/seo/reports',     label: 'Monthly Report' },
]

export function SeoTabNav() {
  const pathname = usePathname()
  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto border-b border-border-default">
      {tabs.map((tab) => {
        const active = tab.href === '/seo' ? pathname === '/seo' : pathname.startsWith(tab.href)
        const upcoming = !!tab.phase
        return (
          <Link
            key={tab.href}
            href={upcoming ? '#' : tab.href}
            aria-disabled={upcoming}
            onClick={(e) => upcoming && e.preventDefault()}
            className={cn(
              'whitespace-nowrap border-b-2 pb-3 pt-1 text-sm transition-colors',
              active && !upcoming
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
