'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type NavItem = {
  href: string
  label: string
  /** When set, renders the link as locked (gray + non-clickable) and shows a small phase tag. */
  phase?: string
}

// Top nav items match the brand reference. Locked items keep the same
// "phase tag" pattern the sidebar used so the visual language stays
// consistent for the client.
const items: NavItem[] = [
  { href: '/overview',     label: 'Overview' },
  { href: '/plan',         label: 'SEO Plan' },
  { href: '/tickets',      label: 'Support & Tickets' },
  { href: '/team',         label: 'Team',         phase: 'soon' },
  { href: '/integrations', label: 'Integrations', phase: 'soon' },
]

export function ClientTopNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/overview' && pathname.startsWith(item.href))
        const upcoming = !!item.phase
        return (
          <Link
            key={item.href}
            href={upcoming ? '#' : item.href}
            aria-disabled={upcoming}
            onClick={(e) => upcoming && e.preventDefault()}
            className={cn(
              'relative whitespace-nowrap py-2 text-sm transition-colors',
              active && !upcoming
                ? 'font-medium text-(--color-llg-purple-700)'
                : 'text-slate-600 hover:text-slate-900',
              upcoming && 'cursor-not-allowed text-slate-400 hover:text-slate-400'
            )}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.phase && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                  {item.phase}
                </span>
              )}
            </span>
            {active && !upcoming && (
              <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-(--color-llg-purple-700)" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
