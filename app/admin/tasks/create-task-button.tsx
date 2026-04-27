'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
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
import { Plus } from 'lucide-react'
import { createTask } from '@/lib/actions/tasks'

type Staff = { id: string; full_name: string | null }
type Department = { id: string; name: string }
type Client = { id: string; firm_name: string }

type Props = {
  staff: Staff[]
  departments: Department[]
  clients: Client[]
  defaultClientId?: string
  defaultDeliverableId?: string
  triggerLabel?: string
}

export function CreateTaskButton({
  staff,
  departments,
  clients,
  defaultClientId,
  defaultDeliverableId,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTask({
        title: String(formData.get('title') ?? '').trim(),
        description: (formData.get('description') as string | null) || null,
        client_id: (formData.get('client_id') as string) || null,
        deliverable_id: defaultDeliverableId ?? null,
        department_id: (formData.get('department_id') as string) || null,
        assigned_to: (formData.get('assigned_to') as string) || null,
        priority: (formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
        due_date: (formData.get('due_date') as string) || null,
      })
      if (result.ok) {
        setOpen(false)
      } else {
        setError(result.error.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {triggerLabel ?? 'New task'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client</Label>
              <Select id="client_id" name="client_id" defaultValue={defaultClientId ?? ''}>
                <option value="">— internal task (no client) —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firm_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department_id">Department</Label>
              <Select id="department_id" name="department_id">
                <option value="">— pick department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assignee</Label>
              <Select id="assigned_to" name="assigned_to">
                <option value="">— unassigned —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
