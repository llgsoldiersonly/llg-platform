'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { assignDeliverable } from '@/lib/actions/deliverables'

export type StaffOption = { id: string; full_name: string | null }

export function DeliverableAssignee({
  deliverableId,
  clientId,
  assignedTo,
  staff,
}: {
  deliverableId: string
  clientId: string
  assignedTo: string | null
  staff: StaffOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value || null
    startTransition(async () => {
      const res = await assignDeliverable(deliverableId, value, clientId)
      if (res.ok) router.refresh()
    })
  }

  return (
    <Select
      value={assignedTo ?? ''}
      onChange={onChange}
      disabled={pending}
      className="w-36 text-xs"
      aria-label="Assign deliverable"
    >
      <option value="">— unassigned —</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name ?? s.id.slice(0, 8)}
        </option>
      ))}
    </Select>
  )
}
