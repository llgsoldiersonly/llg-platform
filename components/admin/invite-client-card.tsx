'use client'

import { useState, useTransition } from 'react'
import { Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteClientUser } from '@/lib/actions/invites'

export function InviteClientCard({
  clientId,
  defaultEmail,
  defaultName,
}: {
  clientId: string
  defaultEmail: string | null
  defaultName: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMessage(null)
    const email = (formData.get('email') as string | null) ?? ''
    const full_name = (formData.get('full_name') as string | null) ?? ''
    startTransition(async () => {
      const result = await inviteClientUser({ client_id: clientId, email, full_name })
      if (result.ok) {
        setMessage({ kind: 'success', text: `Invite sent to ${email}. They'll receive a magic-link email from Supabase.` })
      } else {
        setMessage({ kind: 'error', text: result.error.message })
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-body" />
          Invite client to portal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-body">
          Send a magic-link email so this client can log in to their portal. Pre-filled
          from the primary contact below — edit if a different person should get access.
        </p>
        <form action={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite_full_name">Name</Label>
              <Input
                id="invite_full_name"
                name="full_name"
                required
                defaultValue={defaultName ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                name="email"
                type="email"
                required
                defaultValue={defaultEmail ?? ''}
              />
            </div>
          </div>
          {message && (
            <p
              className={
                message.kind === 'success'
                  ? 'text-xs text-fg-success-strong'
                  : 'text-xs text-fg-danger-strong'
              }
            >
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={isPending} variant="default">
            {isPending ? 'Sending…' : 'Send invite email'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
