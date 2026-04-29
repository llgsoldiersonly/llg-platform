'use client'

import { useState } from 'react'
import { Trash2, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { hardDeleteClientFormAction } from '@/lib/actions/hard-delete'

// Super-admin "Hard delete" with type-firm-name confirmation. Hidden behind
// a disclosure to avoid being clicked-through accidentally. Server action
// archives all client data into client_archives BEFORE running the cascade
// delete, so this is recoverable from DB even after the row is gone.
export function HardDeleteCard({
  clientId,
  clientName,
  errorMessage,
}: {
  clientId: string
  clientName: string
  errorMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === clientName

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-red-700">
          <Trash2 className="h-4 w-4" />
          Hard delete
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-slate-600">
          Permanently removes <strong>{clientName}</strong> and all related data
          (subscriptions, deliverables, calls, posts, rankings, tickets, tasks,
          credentials). A full snapshot is archived to <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">client_archives</code>{' '}
          before the cascade runs, so this is technically recoverable — but only
          from a DB-side restore.
        </p>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'Hide delete form' : 'Show delete form'}
        </button>

        {open && (
          <form action={hardDeleteClientFormAction} className="mt-4 space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
            <input type="hidden" name="client_id" value={clientId} />

            <div className="space-y-1.5">
              <Label htmlFor="confirm_firm_name">
                Type the firm name to confirm: <span className="font-mono text-red-700">{clientName}</span>
              </Label>
              <Input
                id="confirm_firm_name"
                name="confirm_firm_name"
                required
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={clientName}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete_reason">Reason (will be archived in activity_log)</Label>
              <Textarea
                id="delete_reason"
                name="reason"
                required
                minLength={10}
                rows={3}
                placeholder="e.g. client churned 2026-04-15, requested data deletion under retention policy"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-red-700">{errorMessage}</p>
            )}

            <Button
              type="submit"
              variant="destructive"
              disabled={!matches}
              className="w-full"
            >
              {matches ? `Permanently delete ${clientName}` : 'Type the firm name above to enable'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
