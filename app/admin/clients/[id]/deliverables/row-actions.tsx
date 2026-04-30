'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { updateDeliverableStatus, deleteCustomDeliverable } from '@/lib/actions/deliverables'

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'blocked', label: 'Blocked' },
] as const

type Status = typeof STATUSES[number]['value']

export function DeliverableRowActions({
  deliverableId,
  clientId,
  status,
  isCustom,
}: {
  deliverableId: string
  clientId: string
  status: string
  isCustom: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as Status
    setError(null)
    startTransition(async () => {
      const result = await updateDeliverableStatus(deliverableId, newStatus, clientId)
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('Delete this custom deliverable? This cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteCustomDeliverable(deliverableId, clientId)
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Select
        value={status}
        onChange={handleStatusChange}
        disabled={isPending}
        className="w-32 text-xs"
        aria-label="Update status"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {isCustom && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isPending}
          aria-label="Delete deliverable"
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
        </Button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
