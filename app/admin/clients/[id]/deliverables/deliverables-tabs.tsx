'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeliverableRowActions } from './row-actions'

export type DeliverableRow = {
  id: string
  source: 'package' | 'incentive' | 'custom'
  is_incentive: boolean
  template_id: string | null
  status: string
  actual_count: number
  period_start: string
  period_end: string
  notes: string | null
  custom_title: string | null
  custom_description: string | null
  custom_department_slug: string | null
  custom_frequency: string | null
  custom_target_count: number | null
  custom_target_unit: string | null
  template: {
    code: string
    display_name: string
    department_slug: string
    frequency: string
    target_count: number | null
    target_unit: string | null
    tracking_source: string
  } | null
  subscription: {
    id: string
    package: { code: string; display_name: string } | null
  }
}

const sourceBadge = {
  package: { variant: 'secondary' as const, label: 'Package' },
  incentive: { variant: 'success' as const, label: 'Free Bonus' },
  custom: { variant: 'info' as const, label: 'Custom' },
}

const statusBadge: Record<string, 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'info',
  done: 'success',
  skipped: 'warning',
  blocked: 'destructive',
}

type Tab = 'prelaunch' | 'recurring'

function getFrequency(d: DeliverableRow): string {
  return d.template?.frequency ?? d.custom_frequency ?? ''
}

export function DeliverablesTabs({ deliverables, clientId }: { deliverables: DeliverableRow[]; clientId: string }) {
  const { prelaunch, recurring } = useMemo(() => {
    const pre: DeliverableRow[] = []
    const rec: DeliverableRow[] = []
    for (const d of deliverables) {
      if (getFrequency(d) === 'once') pre.push(d)
      else rec.push(d)
    }
    return { prelaunch: pre, recurring: rec }
  }, [deliverables])

  const [tab, setTab] = useState<Tab>(prelaunch.some((d) => d.status !== 'done') ? 'prelaunch' : 'recurring')

  const preOpen = prelaunch.filter((d) => d.status !== 'done').length
  const recOpen = recurring.filter((d) => d.status !== 'done').length

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="text-base">Deliverables</CardTitle>
        <div role="tablist" aria-label="Deliverable lifecycle" className="flex items-center gap-1 rounded-md border border-border-default bg-neutral-secondary-soft p-1 text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'prelaunch'}
            onClick={() => setTab('prelaunch')}
            className={`flex-1 rounded px-3 py-1.5 transition ${
              tab === 'prelaunch' ? 'bg-bg-default font-semibold text-fg-brand-strong shadow-sm' : 'text-body'
            }`}
          >
            Pre-launch checklist
            <span className="ml-2 text-body-subtle">
              {preOpen > 0 ? `${preOpen} open / ` : ''}
              {prelaunch.length} total
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recurring'}
            onClick={() => setTab('recurring')}
            className={`flex-1 rounded px-3 py-1.5 transition ${
              tab === 'recurring' ? 'bg-bg-default font-semibold text-fg-brand-strong shadow-sm' : 'text-body'
            }`}
          >
            Recurring work
            <span className="ml-2 text-body-subtle">
              {recOpen > 0 ? `${recOpen} open / ` : ''}
              {recurring.length} total
            </span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {tab === 'prelaunch' ? (
          <PrelaunchTable rows={prelaunch} clientId={clientId} />
        ) : (
          <RecurringTable rows={recurring} clientId={clientId} />
        )}
      </CardContent>
    </Card>
  )
}

function PrelaunchTable({ rows, clientId }: { rows: DeliverableRow[]; clientId: string }) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-body">
        No pre-launch items. The package's one-time setup deliverables will appear here.
      </p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
        <tr>
          <th className="px-6 py-3 text-left font-medium">Item</th>
          <th className="px-6 py-3 text-left font-medium">Source</th>
          <th className="px-6 py-3 text-left font-medium">Logged</th>
          <th className="px-6 py-3 text-left font-medium">Status</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border-light">
        {rows.map((d) => {
          const title = d.template?.display_name ?? d.custom_title ?? '—'
          const source = sourceBadge[d.source]
          const statusVar = statusBadge[d.status] ?? 'secondary'
          const tracking = d.template?.tracking_source ?? 'manual'
          return (
            <tr key={d.id}>
              <td className="px-6 py-4">
                <div className="font-medium text-heading">{title}</div>
                <div className="text-xs text-body">
                  {d.subscription.package?.code ?? '—'}
                  {d.template?.department_slug && <> · {d.template.department_slug}</>}
                  {d.custom_department_slug && <> · {d.custom_department_slug}</>}
                  {tracking !== 'manual' && <> · auto: {tracking}</>}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant={source.variant}>{source.label}</Badge>
              </td>
              <td className="px-6 py-4 text-body">
                {d.actual_count === 0 ? (
                  <span className="text-body-subtle">—</span>
                ) : (
                  <span>
                    {d.actual_count} URL{d.actual_count === 1 ? '' : 's'}
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                <Badge variant={statusVar}>{d.status.replace('_', ' ')}</Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <DeliverableRowActions
                  deliverableId={d.id}
                  clientId={clientId}
                  status={d.status}
                  isCustom={d.template_id === null}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RecurringTable({ rows, clientId }: { rows: DeliverableRow[]; clientId: string }) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-body">
        No recurring deliverables yet. They'll be auto-generated as subscriptions roll into a new period, or you can add a custom one above.
      </p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
        <tr>
          <th className="px-6 py-3 text-left font-medium">Item</th>
          <th className="px-6 py-3 text-left font-medium">Source</th>
          <th className="px-6 py-3 text-left font-medium">Period</th>
          <th className="px-6 py-3 text-left font-medium">Progress</th>
          <th className="px-6 py-3 text-left font-medium">Status</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border-light">
        {rows.map((d) => {
          const title = d.template?.display_name ?? d.custom_title ?? '—'
          const target = d.template?.target_count ?? d.custom_target_count ?? 0
          const unit = d.template?.target_unit ?? d.custom_target_unit ?? ''
          const source = sourceBadge[d.source]
          const statusVar = statusBadge[d.status] ?? 'secondary'
          const tracking = d.template?.tracking_source ?? 'manual'
          const isPartialComplete = d.status === 'done' && target > 0 && d.actual_count < target
          return (
            <tr key={d.id}>
              <td className="px-6 py-4">
                <div className="font-medium text-heading">{title}</div>
                <div className="text-xs text-body">
                  {d.subscription.package?.code ?? '—'}
                  {d.template?.department_slug && <> · {d.template.department_slug}</>}
                  {d.custom_department_slug && <> · {d.custom_department_slug}</>}
                  {tracking !== 'manual' && <> · auto: {tracking}</>}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant={source.variant}>{source.label}</Badge>
              </td>
              <td className="px-6 py-4 text-xs text-body">
                {d.period_start} → {d.period_end}
              </td>
              <td className="px-6 py-4 text-body">
                <div>
                  {d.actual_count} / {target} {unit}
                </div>
                {isPartialComplete && <div className="text-xs text-body-subtle">marked complete</div>}
              </td>
              <td className="px-6 py-4">
                <Badge variant={statusVar}>{d.status.replace('_', ' ')}</Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <DeliverableRowActions
                  deliverableId={d.id}
                  clientId={clientId}
                  status={d.status}
                  isCustom={d.template_id === null}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
