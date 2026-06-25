'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Pencil } from 'lucide-react'
import { updateClientDetails } from '@/lib/actions/clients'

const STATUSES = ['prospect', 'onboarding', 'active', 'paused', 'churned'] as const
type Status = (typeof STATUSES)[number]

export type EditableClient = {
  id: string
  firm_name: string
  primary_domain: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  vertical: string | null
  status: Status
  notes: string | null
}

export function EditClientDialog({ client }: { client: EditableClient }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateClientDetails({
        client_id: client.id,
        firm_name: String(formData.get('firm_name') ?? ''),
        primary_domain: (formData.get('primary_domain') as string | null) || null,
        primary_contact_name: (formData.get('primary_contact_name') as string | null) || null,
        primary_contact_email: (formData.get('primary_contact_email') as string | null) || null,
        primary_contact_phone: (formData.get('primary_contact_phone') as string | null) || null,
        vertical: (formData.get('vertical') as string | null) || null,
        status: formData.get('status') as Status,
        notes: (formData.get('notes') as string | null) || null,
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
          <DialogDescription>
            Updates the client record. The contact email here is the address shown on the record (and
            pre-filled when inviting) — it does not change an existing portal user&apos;s login email.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firm_name">Firm name</Label>
            <Input id="firm_name" name="firm_name" defaultValue={client.firm_name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="primary_contact_name">Contact name</Label>
              <Input
                id="primary_contact_name"
                name="primary_contact_name"
                defaultValue={client.primary_contact_name ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_email">Contact email</Label>
              <Input
                id="primary_contact_email"
                name="primary_contact_email"
                type="email"
                defaultValue={client.primary_contact_email ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_phone">Contact phone</Label>
              <Input
                id="primary_contact_phone"
                name="primary_contact_phone"
                defaultValue={client.primary_contact_phone ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_domain">Primary domain</Label>
              <Input
                id="primary_domain"
                name="primary_domain"
                defaultValue={client.primary_domain ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vertical">Vertical</Label>
              <Input id="vertical" name="vertical" defaultValue={client.vertical ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={client.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={client.notes ?? ''} rows={2} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
