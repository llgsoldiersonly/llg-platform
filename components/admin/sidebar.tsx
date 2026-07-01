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
  Upload,
  Columns3,
  FileStack,
  Table2,
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
  { href: '/admin/submissions', label: 'Submissions', icon: Upload },
  { href: '/admin/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/admin/tasks/board', label: 'Task board', icon: Columns3 },
  { href: '/admin/tasks/table', label: 'Work table', icon: Table2 },
  { href: '/admin/content-plans', label: 'Content plans', icon: FileStack },
  { href: '/admin/workload', label: 'Workload', icon: TrendingUp },
  { href: '/admin/ads', label: 'Ads', icon: Megaphone },
  { href: '/admin/system/health', label: 'System health', icon: Activity },
  { href: '/admin/settings/users', label: 'Settings', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border-default bg-neutral-primary-soft md:flex md:flex-col">
      <div className="flex items-center gap-3 border-b border-border-default bg-brand-softer px-5 py-4">
        <LlgMark className="h-9 w-9" />
        <div className="leading-tight">
          <h1 className="text-sm font-medium text-heading">Legal Leads Group</h1>
          <p className="text-[10px] uppercase tracking-wider text-fg-brand-strong">Admin</p>
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
                'group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                active && !upcoming
                  ? 'bg-brand-softer text-fg-brand-strong font-medium'
                  : 'text-body hover:bg-neutral-secondary-soft hover:text-heading',
                upcoming && 'cursor-not-allowed text-body-subtle hover:bg-transparent hover:text-body-subtle'
              )}
              onClick={(e) => upcoming && e.preventDefault()}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    active && !upcoming
                      ? 'text-fg-brand'
                      : 'text-body-subtle group-hover:text-fg-brand'
                  )}
                />
                {item.label}
              </span>
              {item.phase && (
                <span className="rounded bg-neutral-tertiary-soft px-1.5 py-0.5 text-[10px] font-mono text-body">
                  {item.phase}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border-default px-5 py-3 text-[10px] uppercase tracking-wider text-body-subtle">
        Rocket Fuel For Your Firm
      </div>
    </aside>
  )
}
