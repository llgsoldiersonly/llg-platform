'use client'

import { useState, useTransition } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { replyToTicket } from '@/lib/actions/tickets'

export function ClientReplyBox({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit() {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await replyToTicket(ticketId, body, false)
      if (result.ok) {
        setBody('')
      } else {
        setError(result.error.message)
      }
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <Textarea
        rows={4}
        placeholder="Add a reply…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isPending || !body.trim()}>
          {isPending ? 'Sending…' : 'Reply'}
        </Button>
      </div>
    </div>
  )
}
