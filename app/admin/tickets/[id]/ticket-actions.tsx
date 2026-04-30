'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  assignTicket,
  closeTicket,
  escalateTicket,
  replyToTicket,
} from '@/lib/actions/tickets'

type Staff = { id: string; full_name: string | null; department_id: string | null }
type Department = { id: string; name: string; slug: string }

type Props = {
  ticketId: string
  currentDepartmentId: string | null
  currentAssigneeId: string | null
  status: string
  staff: Staff[]
  departments: Department[]
}

export function AdminTicketActions({
  ticketId,
  currentDepartmentId,
  currentAssigneeId,
  status,
  staff,
  departments,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)

  function postReply() {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await replyToTicket(ticketId, body, internal)
      if (result.ok) {
        setBody('')
        router.refresh()
      } else setError(result.error.message)
    })
  }

  function onAssign(formData: FormData) {
    const userId = String(formData.get('assigned_user_id'))
    const deptId = String(formData.get('assigned_department_id'))
    if (!userId) return
    setError(null)
    startTransition(async () => {
      const result = await assignTicket(ticketId, userId, deptId || undefined)
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  function onClose() {
    if (!confirm('Close this ticket?')) return
    setError(null)
    startTransition(async () => {
      const result = await closeTicket(ticketId, 'resolved')
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  function onEscalate() {
    if (!confirm('Escalate? This pings #llg-alerts and bumps to URGENT.')) return
    setError(null)
    startTransition(async () => {
      const result = await escalateTicket(ticketId)
      if (!result.ok) setError(result.error.message)
      else router.refresh()
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onAssign} className="space-y-3 text-sm">
            <div className="space-y-2">
              <Label htmlFor="assigned_department_id">Department</Label>
              <Select
                id="assigned_department_id"
                name="assigned_department_id"
                defaultValue={currentDepartmentId ?? ''}
              >
                <option value="">— pick department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_user_id">Assignee</Label>
              <Select
                id="assigned_user_id"
                name="assigned_user_id"
                defaultValue={currentAssigneeId ?? ''}
              >
                <option value="">— pick assignee —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              Save assignment
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reply or note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Type your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            <span>Internal note (clients won't see this)</span>
            {internal && <Badge variant="warning">internal</Badge>}
          </label>
          <Button onClick={postReply} disabled={isPending || !body.trim()} className="w-full">
            {isPending ? 'Sending…' : internal ? 'Post note' : 'Reply to client'}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {status !== 'closed' && (
            <>
              <Button onClick={onClose} disabled={isPending} variant="outline">
                Mark resolved
              </Button>
              <Button onClick={onEscalate} disabled={isPending} variant="destructive">
                Escalate
              </Button>
            </>
          )}
          {error && (
            <span className="text-sm text-fg-danger">{error}</span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
