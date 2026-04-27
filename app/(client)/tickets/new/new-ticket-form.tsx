'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createTicket } from '@/lib/actions/tickets'
import { errorMessages, type ErrorCode } from '@/lib/errors'

const CATEGORIES = [
  { value: 'seo', label: 'SEO' },
  { value: 'design', label: 'Design' },
  { value: 'dev', label: 'Development / website' },
  { value: 'ads', label: 'Ads' },
  { value: 'content', label: 'Content / blogs' },
  { value: 'intakes', label: 'Intakes' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: "Other / I'm not sure" },
] as const

export function NewTicketForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createTicket({
        client_id: clientId,
        type: (formData.get('type') as 'bug' | 'request') ?? 'request',
        subject: String(formData.get('subject') ?? '').trim(),
        category: String(formData.get('category') ?? 'other'),
        priority,
        body: String(formData.get('body') ?? '').trim(),
      })
      if (result.ok) {
        router.push(`/tickets/${result.data.id}`)
      } else {
        setError(result.error.message ?? errorMessages[result.error.code as ErrorCode])
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-400">
            <input type="radio" name="type" value="bug" defaultChecked className="mt-1" />
            <div>
              <p className="text-sm font-medium text-slate-900">Bug</p>
              <p className="text-xs text-slate-500">
                Something's broken on our end. Doesn't count against your quota.
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-400">
            <input type="radio" name="type" value="request" className="mt-1" />
            <div>
              <p className="text-sm font-medium text-slate-900">Request</p>
              <p className="text-xs text-slate-500">
                Something new or different. Counts against your weekly limit.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" name="subject" required maxLength={200} placeholder="Short summary" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select id="category" name="category" required defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
      </div>

      {(priority === 'high' || priority === 'urgent') && (
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          Urgent / High priority tickets get tighter SLAs. Please use this only when something is actively impacting your business.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="body">Description *</Label>
        <Textarea id="body" name="body" required rows={6} placeholder="What happened? What did you expect? Any URLs or screenshots help." />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/tickets')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit ticket'}
        </Button>
      </div>
    </form>
  )
}
