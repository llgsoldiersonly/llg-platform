'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  TrendingUp,
  Briefcase,
  Megaphone,
  Activity,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { LlgMark } from '@/components/brand/logo'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  phase?: string
}

const items: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/tickets', label: 'Tickets', icon: Briefcase },
  { href: '/admin/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/admin/workload', label: 'Workload', icon: TrendingUp },
  { href: '/admin/ads', label: 'Ads', icon: Megaphone },
  { href: '/admin/system/health', label: 'System health', icon: Activity },
  { href: '/admin/settings/users', label: 'Settings', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <LlgMark className="h-9 w-9" />
        <div className="leading-tight">
          <h1 className="font-serif text-sm text-slate-900">Legal Leads Group</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          const upcoming = !!item.phase
          return (
            <Link
              key={item.href}
              href={upcoming ? '#' : item.href}
              aria-disabled={upcoming}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                active && !upcoming
                  ? 'bg-(--color-llg-purple-50) text-(--color-llg-purple-700) font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                upcoming && 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400'
              )}
              onClick={(e) => upcoming && e.preventDefault()}
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
