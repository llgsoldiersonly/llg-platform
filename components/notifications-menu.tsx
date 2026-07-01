'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/actions/notifications'

export type NotificationItem = {
  id: string
  type: string
  subject: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function NotificationsMenu({
  items,
  unread,
}: {
  items: NotificationItem[]
  unread: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id)
      router.refresh()
    })
  }
  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-body hover:bg-neutral-secondary-soft hover:text-heading"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border-default bg-bg-default shadow-lg">
            <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
              <span className="text-sm font-semibold text-heading">Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={markAll} className="text-xs text-fg-brand hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-body-subtle">You&apos;re all caught up.</p>
              ) : (
                <ul className="divide-y divide-border-light">
                  {items.map((n) => {
                    const inner = (
                      <div className={`px-4 py-3 ${n.read_at ? 'opacity-60' : 'bg-brand-soft/20'}`}>
                        <div className="flex items-start gap-2">
                          {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-fg-brand" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-heading">{n.subject}</p>
                            {n.body && <p className="truncate text-xs text-body">{n.body}</p>}
                            <p className="mt-0.5 text-[11px] text-body-subtle">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                    return (
                      <li key={n.id} onClick={() => !n.read_at && markRead(n.id)}>
                        {n.link ? (
                          <Link href={n.link} onClick={() => setOpen(false)}>
                            {inner}
                          </Link>
                        ) : (
                          <div className="cursor-pointer">{inner}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
