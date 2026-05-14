'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { submitDeliverable } from '@/lib/actions/submissions'
import { SUBMISSION_KINDS, type SubmissionKind } from '@/lib/submissions/kinds'
import { errorMessages, type ErrorCode } from '@/lib/errors'

type FirmRow = { id: string; firm_name: string; status: string }
type DeliverableRow = {
  id: string
  client_id: string
  title: string
  module_code: string
  period_start: string
  period_end: string
  target_count: number | null
  actual_count: number | null
}

// The /staff workspace's ONE form. Submit fires the existing
// submitDeliverable server action, which auto-approves on insert via the
// DB trigger. Resets after a successful submission so staff can rip off
// multiple in a row without page reload.
export function StaffSubmitForm({
  firms,
  deliverables,
}: {
  firms: FirmRow[]
  deliverables: DeliverableRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [clientId, setClientId] = useState<string>('')
  const [kind, setKind] = useState<SubmissionKind>('blog')
  const [deliverableId, setDeliverableId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const matchingDeliverables = useMemo(
    () => deliverables.filter((d) => d.client_id === clientId),
    [deliverables, clientId]
  )

  function onSubmit(formData: FormData) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await submitDeliverable({
        client_id: clientId,
        kind,
        link_url: String(formData.get('link_url') ?? '').trim(),
        title: String(formData.get('title') ?? '').trim() || null,
        notes: String(formData.get('notes') ?? '').trim() || null,
        deliverable_id: deliverableId || null,
      })
      if (result.ok) {
        setNotice('Logged. Client sees this immediately.')
        const form = document.getElementById('staff-submit-form') as HTMLFormElement | null
        form?.reset()
        setDeliverableId('')
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  return (
    <form id="staff-submit-form" action={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="client_id">Firm *</Label>
        <Select
          id="client_id"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value)
            setDeliverableId('')
          }}
          required
        >
          <option value="">— Pick a firm —</option>
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.firm_name}
              {f.status !== 'active' ? ` (${f.status})` : ''}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Kind *</Label>
          <Select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SubmissionKind)}
            required
          >
            {SUBMISSION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliverable_id">Counts toward (optional)</Label>
          <Select
            id="deliverable_id"
            value={deliverableId}
            onChange={(e) => setDeliverableId(e.target.value)}
            disabled={!clientId || matchingDeliverables.length === 0}
          >
            <option value="">— None / pre-launch —</option>
            {matchingDeliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.actual_count ?? 0}/{d.target_count ?? '∞'})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="link_url">Link to work *</Label>
        <Input
          id="link_url"
          name="link_url"
          type="url"
          required
          placeholder="https://example.com/the-blog-post"
        />
        <p className="text-xs text-body-subtle">
          The URL the client can open to see what you published.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder="e.g. 'Top 10 things to do after a car accident'"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Becomes the excerpt on widget previews."
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger-soft p-3 text-sm text-fg-danger-strong">{error}</p>
      )}
      {notice && (
        <p className="rounded-md bg-success-soft p-3 text-sm text-fg-success-strong">{notice}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !clientId}>
          {isPending ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
