'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { submitDeliverable } from '@/lib/actions/submissions'
import { type SubmissionKind, getSubmissionKind } from '@/lib/submissions/kinds'
import { errorMessages, type ErrorCode } from '@/lib/errors'

// Compact submit modal for the inline staff workflow. Unlike the full
// /admin/submissions/new form, this one has the firm + kind pre-selected
// (no dropdowns) and is opened by clicking an action button on a specific
// widget row. Auto-approve via DB trigger means the submission lands on
// the client view immediately.
export function InlineSubmitModal({
  open,
  onOpenChange,
  clientId,
  kind,
  deliverableId,
  triggerLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  kind: SubmissionKind
  // When set, increments that deliverable's actual_count on save.
  deliverableId?: string | null
  // Optional label shown in the dialog header above the kind (e.g.
  // "Blogs" or "FAQ pages" so the staff member knows which row they
  // clicked).
  triggerLabel?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [linkUrl, setLinkUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const kindMeta = getSubmissionKind(kind)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitDeliverable({
        client_id: clientId,
        kind,
        link_url: linkUrl.trim(),
        title: title.trim() || null,
        notes: notes.trim() || null,
        deliverable_id: deliverableId ?? null,
      })
      if (result.ok) {
        setLinkUrl('')
        setTitle('')
        setNotes('')
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log {triggerLabel ?? kindMeta?.label ?? 'work'}</DialogTitle>
          <DialogDescription>
            Paste the URL where the work is live. The client will see it on their portal immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inline-link">Link to work *</Label>
            <Input
              id="inline-link"
              type="url"
              required
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/the-post"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inline-title">Title (optional)</Label>
            <Input
              id="inline-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title for the client to see"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inline-notes">Notes (optional)</Label>
            <Textarea
              id="inline-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context worth surfacing as the excerpt"
            />
          </div>
          {error && (
            <p className="rounded-md bg-danger-soft p-2 text-sm text-fg-danger-strong">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !linkUrl.trim()}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
