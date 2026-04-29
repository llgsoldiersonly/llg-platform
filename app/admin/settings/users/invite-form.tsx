'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { inviteStaff } from '@/lib/actions/invites'

type Department = { id: string; name: string; slug: string }

export function InviteStaffForm({ departments }: { departments: Department[] }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMessage(null)
    const email = (formData.get('email') as string | null) ?? ''
    const full_name = (formData.get('full_name') as string | null) ?? ''
    const role = (formData.get('role') as 'agency_staff' | 'super_admin' | null) ?? 'agency_staff'
    const title = (formData.get('title') as string | null) || null
    const department_id = (formData.get('department_id') as string | null) || null

    startTransition(async () => {
      const result = await inviteStaff({ email, full_name, role, department_id, title })
      if (result.ok) {
        setMessage({ kind: 'success', text: `Invite email sent to ${email}.` })
      } else {
        setMessage({ kind: 'error', text: result.error.message })
      }
    })
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required placeholder="Maria Soto" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="maria@lucrativelegal.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="agency_staff">
          <option value="agency_staff">Agency staff</option>
          <option value="super_admin">Super admin</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="department_id">Department (optional)</Label>
        <Select id="department_id" name="department_id" defaultValue="">
          <option value="">— none —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" placeholder="SEO Specialist" />
      </div>
      <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200 pt-4">
        <div>
          {message && (
            <p className={message.kind === 'success' ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>
              {message.text}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending invite…' : 'Send invite'}
        </Button>
      </div>
    </form>
  )
}
