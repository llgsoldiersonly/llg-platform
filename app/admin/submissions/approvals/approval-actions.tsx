'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { approveSubmission, rejectSubmission } from '@/lib/actions/submissions'
import { errorMessages, type ErrorCode } from '@/lib/errors'
import { Check, X } from 'lucide-react'

export function ApprovalActions({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveSubmission(submissionId)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  function onReject() {
    setError(null)
    if (!reason.trim()) {
      setError('A reason is required.')
      return
    }
    startTransition(async () => {
      const result = await rejectSubmission(submissionId, reason)
      if (result.ok) {
        setRejectOpen(false)
        setReason('')
        router.refresh()
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={onApprove}
          disabled={isPending}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              <X className="h-4 w-4" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject submission</DialogTitle>
              <DialogDescription>
                Tell the submitter what needs to change. They'll see this reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="e.g. 'Link is to the draft, not the published post.'"
              />
              {error && (
                <p className="text-sm text-fg-danger-strong">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onReject} disabled={isPending}>
                {isPending ? 'Rejecting…' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {error && !rejectOpen && (
        <p className="text-xs text-fg-danger-strong">{error}</p>
      )}
    </div>
  )
}
