'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { setClientIntakeMode, type IntakeMode } from '@/lib/actions/intakes'

// Two shapes:
// - `firms` set → "add a firm" row: pick firm + kind, then Add.
// - `clientId` set → inline mode change / removal for an enabled firm.
export function IntakeModePicker({
  firms,
  clientId,
  current,
  compact,
}: {
  firms?: { id: string; name: string }[]
  clientId?: string
  current?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [firm, setFirm] = useState('')
  const [mode, setMode] = useState<IntakeMode>('intakes_only')

  function apply(targetClient: string, targetMode: IntakeMode) {
    setError(null)
    startTransition(async () => {
      const res = await setClientIntakeMode(targetClient, targetMode)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  if (clientId) {
    return (
      <span className="flex items-center gap-2">
        <Select
          value={current}
          onChange={(e) => {
            const v = e.target.value as IntakeMode
            if (v === 'none' && !window.confirm('Remove this firm from the intake service? Existing leads are kept.')) {
              return
            }
            apply(clientId, v)
          }}
          disabled={pending}
          className={compact ? 'h-8 w-auto text-xs' : undefined}
        >
          <option value="intakes_only">Intakes only</option>
          <option value="intakes_leads">Intakes + Leads</option>
          <option value="none">Remove from intakes</option>
        </Select>
        {error && <span className="text-xs text-fg-danger">{error}</span>}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={firm} onChange={(e) => setFirm(e.target.value)} className="max-w-xs">
        <option value="">— Pick a firm —</option>
        {(firms ?? []).map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Select value={mode} onChange={(e) => setMode(e.target.value as IntakeMode)} className="w-auto">
        <option value="intakes_only">Intakes only</option>
        <option value="intakes_leads">Intakes + Leads</option>
      </Select>
      <Button size="sm" disabled={pending || !firm} onClick={() => apply(firm, mode)}>
        {pending ? 'Adding…' : 'Add firm'}
      </Button>
      {error && <span className="text-xs text-fg-danger">{error}</span>}
    </div>
  )
}
