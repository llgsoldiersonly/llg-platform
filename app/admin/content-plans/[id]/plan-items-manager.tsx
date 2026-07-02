'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/ui/infotip'
import { assignPlanItems, distributePlanItems } from '@/lib/actions/content-plans'

export type PlanItem = {
  id: string
  keyword: string
  practice_area: string | null
  tier: string | null
  target_slug: string | null
  status: string
  assigned_to: string | null
  assigneeName: string | null
}

type Staff = { id: string; name: string }

const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success'> = {
  todo: 'secondary',
  in_progress: 'warning',
  in_review: 'warning',
  done: 'success',
  cancelled: 'secondary',
}

export function PlanItemsManager({
  planId,
  items,
  staff,
}: {
  planId: string
  items: PlanItem[]
  staff: Staff[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAssignee, setBulkAssignee] = useState('')

  const allSelected = items.length > 0 && selected.size === items.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  function assignSelected() {
    setError(null)
    if (selected.size === 0) {
      setError('Select at least one row.')
      return
    }
    startTransition(async () => {
      const res = await assignPlanItems(Array.from(selected), bulkAssignee || null)
      if (!res.ok) setError(res.error.message)
      else {
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  function distributeAll() {
    setError(null)
    if (staff.length === 0) {
      setError('No staff available to distribute to.')
      return
    }
    startTransition(async () => {
      const res = await distributePlanItems(planId, staff.map((s) => s.id))
      if (!res.ok) setError(res.error.message)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-neutral-primary-soft p-3">
        <span className="text-sm text-body">
          {selected.size > 0 ? `${selected.size} selected` : 'Select rows to assign'}
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
            className="w-48 text-sm"
            aria-label="Assignee for selected rows"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Button size="sm" onClick={assignSelected} disabled={isPending || selected.size === 0}>
            Assign selected
          </Button>
        </div>
        <span className="text-border-default">|</span>
        <span className="inline-flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={distributeAll} disabled={isPending}>
            Distribute unassigned evenly
          </Button>
          <InfoTip text="Round-robins every currently-unassigned row across the staff list, in row order. Each assigned row becomes a task on that person's board." />
        </span>
        {error && <p className="text-sm text-fg-danger">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border-default"
                  aria-label="Select all rows"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium">Keyword</th>
              <th className="px-3 py-3 text-left font-medium">Practice area</th>
              <th className="px-3 py-3 text-left font-medium">Tier</th>
              <th className="px-3 py-3 text-left font-medium">Assignee</th>
              <th className="px-3 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {items.map((it) => (
              <tr key={it.id} className={selected.has(it.id) ? 'bg-brand-softer/40' : ''}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4 rounded border-border-default"
                    aria-label={`Select ${it.keyword}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-heading">{it.keyword}</span>
                  {it.target_slug && (
                    <span className="block text-xs text-body-subtle">{it.target_slug}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-body">{it.practice_area ?? '—'}</td>
                <td className="px-3 py-2.5 text-body">{it.tier ?? '—'}</td>
                <td className="px-3 py-2.5 text-body">
                  {it.assigneeName ?? <span className="text-body-subtle">Unassigned</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={STATUS_VARIANT[it.status] ?? 'secondary'}>
                    {it.status.replace('_', ' ')}
                  </Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-body">
                  This plan has no rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
