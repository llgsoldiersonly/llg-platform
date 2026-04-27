'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardCheck,
  Briefcase,
  Users,
  Plug,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  phase?: string
}

const items: NavItem[] = [
  { href: '/overview',     label: 'Overview',     icon: LayoutDashboard },
  { href: '/plan',         label: 'My plan',      icon: ClipboardCheck },
  { href: '/tickets',      label: 'Tickets',      icon: Briefcase, phase: 'Phase 5' },
  { href: '/team',         label: 'My team',      icon: Users,     phase: 'Phase 9' },
  { href: '/integrations', label: 'Integrations', icon: Plug,      phase: 'Phase 6' },
  { href: '/profile',      label: 'Profile',      icon: User },
]

export function ClientSidebar({ firmName }: { firmName: string }) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Welcome</p>
        <h1 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{firmName}</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/overview' && pathname.startsWith(item.href))
          const Icon = item.icon
          const upcoming = !!item.phase
          return (
            <Link
              key={item.href}
              href={upcoming ? '#' : item.href}
              aria-disabled={upcoming}
              onClick={(e) => upcoming && e.preventDefault()}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                active && !upcoming
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                upcoming && 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.phase && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                  {item.phase}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
