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
import { Pencil } from 'lucide-react'
import { updateStaffMember } from '@/lib/actions/invites'

type Department = { id: string; name: string; slug: string }

type StaffProfile = {
  id: string
  full_name: string | null
  role: 'agency_staff' | 'client_user' | 'super_admin'
  title: string | null
  is_active: boolean
  department_id: string | null
}

export function StaffRowEditor({
  profile,
  departments,
}: {
  profile: StaffProfile
  departments: Department[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateStaffMember({
        user_id: profile.id,
        full_name: String(formData.get('full_name') ?? '').trim() || null,
        role: formData.get('role') as 'agency_staff' | 'super_admin',
        department_id: (formData.get('department_id') as string) || null,
        title: (formData.get('title') as string | null)?.trim() || null,
        is_active: formData.get('is_active') === 'on',
      })
      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })
  }

  // Only staff roles are editable here; a client_user shouldn't appear on this
  // page, but default the select safely just in case.
  const roleDefault = profile.role === 'super_admin' ? 'super_admin' : 'agency_staff'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit staff member</DialogTitle>
          <DialogDescription>
            Update department, title, role, or active status. Role changes take effect on their next
            page load.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`full_name_${profile.id}`}>Full name</Label>
            <Input
              id={`full_name_${profile.id}`}
              name="full_name"
              defaultValue={profile.full_name ?? ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`role_${profile.id}`}>Role</Label>
              <Select id={`role_${profile.id}`} name="role" defaultValue={roleDefault}>
                <option value="agency_staff">Agency staff</option>
                <option value="super_admin">Super admin</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`department_${profile.id}`}>Department</Label>
              <Select
                id={`department_${profile.id}`}
                name="department_id"
                defaultValue={profile.department_id ?? ''}
              >
                <option value="">— none —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`title_${profile.id}`}>Title</Label>
            <Input id={`title_${profile.id}`} name="title" defaultValue={profile.title ?? ''} />
          </div>

          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={profile.is_active}
              className="h-4 w-4 rounded border-border-default"
            />
            Active (can access the admin)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
