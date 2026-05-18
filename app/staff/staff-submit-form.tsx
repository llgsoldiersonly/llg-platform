'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { submitDeliverable, submitDeliverableBatch } from '@/lib/actions/submissions'
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

type Mode = 'single' | 'bulk'

// The /staff workspace's ONE form. Single mode: one URL + optional title/notes.
// Bulk mode: paste many URLs (one per line) — each becomes its own audit row;
// title/notes apply to the whole batch. When a deliverable is selected, an
// optional "Mark complete" toggle flips the deliverable to status=done
// regardless of actual_count vs target_count.
export function StaffSubmitForm({
  firms,
  deliverables,
}: {
  firms: FirmRow[]
  deliverables: DeliverableRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>('single')
  const [clientId, setClientId] = useState<string>('')
  const [kind, setKind] = useState<SubmissionKind>('blog')
  const [deliverableId, setDeliverableId] = useState<string>('')
  const [markComplete, setMarkComplete] = useState(false)
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
      if (mode === 'single') {
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
          resetForm()
          router.refresh()
        } else {
          setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
        }
        return
      }

      const raw = String(formData.get('bulk_urls') ?? '')
      const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      const result = await submitDeliverableBatch({
        client_id: clientId,
        kind,
        link_urls: urls,
        title: String(formData.get('title') ?? '').trim() || null,
        notes: String(formData.get('notes') ?? '').trim() || null,
        deliverable_id: deliverableId || null,
        mark_complete: markComplete,
      })
      if (result.ok) {
        const completedSuffix = result.data.marked_complete
          ? ' Deliverable marked complete.'
          : ''
        setNotice(`Logged ${result.data.inserted} submission${result.data.inserted === 1 ? '' : 's'}.${completedSuffix}`)
        resetForm()
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  function resetForm() {
    const form = document.getElementById('staff-submit-form') as HTMLFormElement | null
    form?.reset()
    setDeliverableId('')
    setMarkComplete(false)
  }

  return (
    <form id="staff-submit-form" action={onSubmit} className="space-y-5">
      <div className="flex items-center gap-2 rounded-md border border-border-default bg-neutral-secondary-soft p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 rounded px-3 py-1.5 transition ${
            mode === 'single' ? 'bg-bg-default font-medium shadow-sm' : 'text-body'
          }`}
        >
          Single
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`flex-1 rounded px-3 py-1.5 transition ${
            mode === 'bulk' ? 'bg-bg-default font-medium shadow-sm' : 'text-body'
          }`}
        >
          Bulk paste
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_id">Firm *</Label>
        <Select
          id="client_id"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value)
            setDeliverableId('')
            setMarkComplete(false)
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
            onChange={(e) => {
              setDeliverableId(e.target.value)
              if (!e.target.value) setMarkComplete(false)
            }}
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

      {mode === 'single' ? (
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
      ) : (
        <div className="space-y-2">
          <Label htmlFor="bulk_urls">Links to work * (one per line)</Label>
          <Textarea
            id="bulk_urls"
            name="bulk_urls"
            rows={8}
            required
            placeholder={'https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3'}
            className="font-mono text-xs"
          />
          <p className="text-xs text-body-subtle">
            Paste any number of URLs (one per line). Each becomes its own audit-trail row the client can open. Title and notes below apply to the whole batch.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder={mode === 'bulk' ? 'Shared title for all rows in this batch' : "e.g. 'Top 10 things to do after a car accident'"}
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

      {mode === 'bulk' && (
        <label
          className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
            deliverableId
              ? 'border-border-default'
              : 'border-border-light bg-neutral-secondary-soft text-body-subtle'
          }`}
        >
          <input
            type="checkbox"
            checked={markComplete}
            onChange={(e) => setMarkComplete(e.target.checked)}
            disabled={!deliverableId}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Also mark this deliverable complete</span>
            <span className="block text-xs">
              {deliverableId
                ? 'Flips the deliverable to ✅ Done regardless of how many URLs are pasted. The count stays as-is (e.g. 20/100 logged, marked complete).'
                : 'Pick a deliverable above to enable this.'}
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="rounded-md bg-danger-soft p-3 text-sm text-fg-danger-strong">{error}</p>
      )}
      {notice && (
        <p className="rounded-md bg-success-soft p-3 text-sm text-fg-success-strong">{notice}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !clientId}>
          {isPending ? 'Submitting…' : mode === 'bulk' ? 'Submit batch' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
