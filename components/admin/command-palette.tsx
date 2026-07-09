'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Building2, LayoutGrid } from 'lucide-react'
import { quickSearch, type QuickSearchResult } from '@/lib/actions/quick-search'

// Static destinations, matched locally by label — always instant.
const PAGES: { label: string; href: string; keywords?: string }[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Tasks — list', href: '/admin/tasks', keywords: 'tasks list' },
  { label: 'Tasks — board', href: '/admin/tasks/board', keywords: 'kanban board' },
  { label: 'Tasks — work table', href: '/admin/tasks/table', keywords: 'table grouped wrike' },
  { label: 'Content plans', href: '/admin/content-plans', keywords: 'keywords sitemap blogs' },
  { label: 'Workload', href: '/admin/workload', keywords: 'capacity hours' },
  { label: 'Workflow templates', href: '/admin/settings/task-templates', keywords: 'steps sop pipeline' },
  { label: 'Clients', href: '/admin/clients', keywords: 'firms' },
  { label: 'Submissions', href: '/admin/submissions', keywords: 'work log' },
  { label: 'Tickets', href: '/admin/tickets', keywords: 'support' },
  { label: 'Ads', href: '/admin/ads' },
  { label: 'Users', href: '/admin/settings/users', keywords: 'staff settings capacity leads' },
  { label: 'System health', href: '/admin/system/health', keywords: 'crons sync' },
]

type Item = { key: string; group: 'Pages' | 'Tasks' | 'Clients'; label: string; sub?: string; href: string }

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [data, setData] = useState<QuickSearchResult>({ tasks: [], clients: [] })
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)

  // Global shortcut: Cmd+K (mac) / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setData({ tasks: [], clients: [] })
      setActive(0)
      // Focus after the dialog paints.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced server search; sequence guard drops stale responses.
  useEffect(() => {
    if (!open) return
    const query = q.trim()
    if (query.length < 2) {
      setData({ tasks: [], clients: [] })
      return
    }
    const seq = ++seqRef.current
    const t = setTimeout(async () => {
      const res = await quickSearch(query)
      if (res.ok && seqRef.current === seq) setData(res.data)
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase()
    const pages = needle
      ? PAGES.filter((p) => `${p.label} ${p.keywords ?? ''}`.toLowerCase().includes(needle))
      : PAGES.slice(0, 6)
    return [
      ...pages.map<Item>((p) => ({ key: `p-${p.href}`, group: 'Pages', label: p.label, href: p.href })),
      ...data.tasks.map<Item>((t) => ({
        key: `t-${t.id}`,
        group: 'Tasks',
        label: t.title,
        sub: `#${t.task_number} · ${t.firmName ?? 'internal'} · ${t.status.replace(/_/g, ' ')}`,
        href: `/admin/tasks/${t.id}`,
      })),
      ...data.clients.map<Item>((c) => ({
        key: `c-${c.id}`,
        group: 'Clients',
        label: c.firm_name,
        sub: c.status,
        href: `/admin/clients/${c.id}`,
      })),
    ]
  }, [q, data])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)))
  }, [items])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      go(items[active].href)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const groupIcon = { Pages: LayoutGrid, Tasks: FileText, Clients: Building2 } as const
  let lastGroup: string | null = null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-body-subtle hover:border-border-brand hover:text-body sm:inline-flex"
      >
        <Search className="h-3.5 w-3.5" />
        Search
        <kbd className="rounded border border-border-default bg-neutral-secondary-soft px-1.5 text-[10px]">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border-default bg-bg-default shadow-xl">
            <div className="flex items-center gap-2 border-b border-border-default px-3">
              <Search className="h-4 w-4 shrink-0 text-body-subtle" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Jump to a page, task, or client…"
                className="w-full bg-transparent py-3 text-sm text-heading outline-none"
              />
              <kbd className="rounded border border-border-default px-1.5 text-[10px] text-body-subtle">esc</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-body-subtle">
                  {q.trim().length < 2 ? 'Type to search tasks and clients.' : 'No matches.'}
                </p>
              ) : (
                items.map((item, i) => {
                  const header = item.group !== lastGroup ? item.group : null
                  lastGroup = item.group
                  const Icon = groupIcon[item.group]
                  return (
                    <div key={item.key}>
                      {header && (
                        <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-body-subtle">
                          {header}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm ${
                          i === active ? 'bg-brand-soft/50 text-heading' : 'text-body'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-body-subtle" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{item.label}</span>
                          {item.sub && <span className="block truncate text-xs text-body-subtle">{item.sub}</span>}
                        </span>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
