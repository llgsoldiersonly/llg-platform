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
  { href: '/seo',          label: 'SEO Insights' },
  { href: '/tickets',      label: 'Support & Tickets' },
  { href: '/team',         label: 'Team',         phase: 'soon' },
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
                ? 'font-medium text-fg-brand'
                : 'text-body hover:text-heading',
              upcoming && 'cursor-not-allowed text-body-subtle hover:text-body-subtle'
            )}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.phase && (
                <span className="rounded bg-neutral-tertiary-soft px-1.5 py-0.5 text-[10px] font-mono text-body">
                  {item.phase}
                </span>
              )}
            </span>
            {active && !upcoming && (
              <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-brand" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
