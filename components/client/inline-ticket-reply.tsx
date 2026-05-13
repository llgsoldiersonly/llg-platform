'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { replyToTicket } from '@/lib/actions/tickets'
import { errorMessages, type ErrorCode } from '@/lib/errors'

// Inline staff reply modal. Posts to ticket_messages via replyToTicket.
// Keeps context light — staff who need the full thread click "Open ticket
// →" to navigate to /admin/tickets/[id]. The point here is unblocking
// quick follow-ups without leaving the client portal.
export function InlineTicketReplyModal({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
  subject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  ticketNumber: number
  subject: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await replyToTicket(ticketId, body.trim(), isInternalNote)
      if (result.ok) {
        setBody('')
        setIsInternalNote(false)
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
          <DialogTitle>Reply to #{ticketNumber}</DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reply-body">Reply *</Label>
            <Textarea
              id="reply-body"
              required
              autoFocus
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                isInternalNote
                  ? "Internal note — only staff will see this."
                  : "Reply visible to the client."
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              className="h-4 w-4 rounded border-border-default-medium"
            />
            Internal note (hidden from client)
          </label>

          {error && (
            <p className="rounded-md bg-danger-soft p-2 text-sm text-fg-danger-strong">{error}</p>
          )}

          <DialogFooter className="flex items-center justify-between sm:flex-row">
            <Link
              href={`/admin/tickets/${ticketId}`}
              className="text-xs text-fg-brand hover:underline"
            >
              Open full ticket →
            </Link>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !body.trim()}>
                {isPending ? 'Posting…' : 'Post reply'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
