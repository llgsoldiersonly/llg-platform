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
import { replaceSubmission } from '@/lib/actions/submissions'
import { errorMessages, type ErrorCode } from '@/lib/errors'
import { RefreshCw } from 'lucide-react'

// Per-row "Replace" affordance for /admin/submissions. Opens a modal
// pre-filled with the row's current values. Save soft-deletes the
// original (status='rejected', reason='Replaced') and inserts a fresh
// row via replaceSubmission server action.
export function ReplaceSubmissionRow({
  submissionId,
  currentLinkUrl,
  currentTitle,
  currentNotes,
}: {
  submissionId: string
  currentLinkUrl: string
  currentTitle: string | null
  currentNotes: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [linkUrl, setLinkUrl] = useState(currentLinkUrl)
  const [title, setTitle] = useState(currentTitle ?? '')
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await replaceSubmission({
        original_id: submissionId,
        link_url: linkUrl.trim(),
        title: title.trim() || null,
        notes: notes.trim() || null,
      })
      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        aria-label="Replace this submission"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Replace
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace submission</DialogTitle>
            <DialogDescription>
              Soft-deletes the original (kept for audit, hidden from client) and inserts a
              fresh row with the corrected values. Same kind, same deliverable — change the
              link and any other detail that needs fixing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="replace-link">Link to work *</Label>
              <Input
                id="replace-link"
                type="url"
                required
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/the-post"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-title">Title</Label>
              <Input
                id="replace-title"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-notes">Notes</Label>
              <Textarea
                id="replace-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            {error && (
              <p className="rounded-md bg-danger-soft p-2 text-sm text-fg-danger-strong">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !linkUrl.trim()}>
                {isPending ? 'Replacing…' : 'Save replacement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
