'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export type TicketSummary = {
  id: string
  ticket_number: number
  subject: string
  status: 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed'
  created_at: string
}

type Tab = 'open' | 'closed'

const ROW_LIMIT = 5

export function SupportTicketsCard({ tickets }: { tickets: TicketSummary[] }) {
  const [tab, setTab] = useState<Tab>('open')

  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed')
  const closedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')
  const visible = tab === 'open' ? openTickets : closedTickets

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg">Support &amp; Tickets</CardTitle>
        <Link href="/tickets/new">
          <Button size="sm">Create New Ticket</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="tablist" aria-label="Ticket filter" className="grid grid-cols-2 border-b border-border-light">
          <TabButton active={tab === 'open'} onClick={() => setTab('open')}>
            Open Tickets
          </TabButton>
          <TabButton active={tab === 'closed'} onClick={() => setTab('closed')}>
            Closed Tickets
          </TabButton>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-body">
            {tab === 'open'
              ? "No open tickets — open one any time something needs the team's attention."
              : 'No closed tickets yet.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.slice(0, ROW_LIMIT).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-brand-softer"
                >
                  <span className="flex-1 truncate text-sm text-heading group-hover:text-fg-brand">
                    {t.subject}
                  </span>
                  <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>
                </Link>
              </li>
            ))}
            {visible.length > ROW_LIMIT && (
              <li className="pt-1 text-right">
                <Link href="/tickets" className="text-xs text-fg-brand hover:underline">
                  View all {visible.length} tickets →
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative py-3 text-center text-sm font-medium transition-colors',
        active ? 'text-fg-brand' : 'text-body hover:text-heading'
      )}
    >
      {children}
      {active && (
        <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-fg-brand" />
      )}
    </button>
  )
}

function statusVariant(status: TicketSummary['status']): 'secondary' | 'info' | 'warning' | 'success' {
  switch (status) {
    case 'resolved':
      return 'success'
    case 'closed':
      return 'secondary'
    case 'in_progress':
    case 'waiting_on_client':
      return 'warning'
    default:
      return 'info'
  }
}

function statusLabel(status: TicketSummary['status']): string {
  switch (status) {
    case 'in_progress':
      return 'in progress'
    case 'waiting_on_client':
      return 'waiting on you'
    default:
      return status
  }
}
