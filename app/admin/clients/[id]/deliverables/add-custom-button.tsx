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
import { Plus } from 'lucide-react'
import { addCustomDeliverable } from '@/lib/actions/deliverables'

const DEPARTMENTS = [
  { slug: 'seo', label: 'SEO' },
  { slug: 'content', label: 'Content' },
  { slug: 'design', label: 'Design' },
  { slug: 'development', label: 'Development' },
  { slug: 'paid_ads', label: 'Paid Ads' },
  { slug: 'local_gmb', label: 'Local / GMB' },
  { slug: 'ai_voice', label: 'AI / Voice' },
  { slug: 'intakes', label: 'Intakes' },
  { slug: 'account_mgmt', label: 'Account Management' },
]

type Subscription = {
  id: string
  package: { code: string; display_name: string } | null
}

type Props = {
  clientId: string
  subscriptions: Subscription[]
}

export function AddCustomDeliverableButton({ clientId, subscriptions }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    startTransition(async () => {
      const result = await addCustomDeliverable({
        client_id: clientId,
        subscription_id: String(formData.get('subscription_id')),
        custom_title: String(formData.get('custom_title') ?? '').trim(),
        custom_description: (formData.get('custom_description') as string | null) || null,
        custom_department_slug: String(formData.get('custom_department_slug')),
        custom_frequency: formData.get('custom_frequency') as 'once' | 'weekly' | 'monthly' | 'quarterly' | 'ongoing',
        custom_target_count: Number(formData.get('custom_target_count') ?? 1),
        custom_target_unit: (formData.get('custom_target_unit') as string | null) || null,
        is_incentive: formData.get('is_incentive') === 'on',
        period_start: (formData.get('period_start') as string) || today,
        period_end: (formData.get('period_end') as string) || future,
        notes: (formData.get('notes') as string | null) || null,
      })

      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error.message)
      }
    })
  }

  if (subscriptions.length === 0) {
    return (
      <span className="text-xs text-slate-500">
        Add a subscription before creating custom deliverables.
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add custom deliverable
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add custom deliverable</DialogTitle>
          <DialogDescription>
            Use this for one-off bonuses, incentives, or upsells outside the standard package.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subscription_id">Attach to subscription</Label>
            <Select id="subscription_id" name="subscription_id" required>
              {subscriptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.package?.display_name ?? 'Unknown'} ({s.package?.code ?? '—'})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_title">Title *</Label>
            <Input id="custom_title" name="custom_title" required placeholder="e.g. Free Basic Website" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_description">Description</Label>
            <Textarea
              id="custom_description"
              name="custom_description"
              placeholder="What is this and why are we giving it to them?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custom_department_slug">Department</Label>
              <Select id="custom_department_slug" name="custom_department_slug" defaultValue="account_mgmt">
                {DEPARTMENTS.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_frequency">Frequency</Label>
              <Select id="custom_frequency" name="custom_frequency" defaultValue="once">
                <option value="once">Once</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="ongoing">Ongoing</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custom_target_count">Target count</Label>
              <Input id="custom_target_count" name="custom_target_count" type="number" min={1} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_target_unit">Unit</Label>
              <Input id="custom_target_unit" name="custom_target_unit" placeholder="site, audit, post…" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period start</Label>
              <Input id="period_start" name="period_start" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period end</Label>
              <Input
                id="period_end"
                name="period_end"
                type="date"
                defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_incentive" className="h-4 w-4" />
            <span>Mark as a free incentive (renders as "Free Bonus" badge)</span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea id="notes" name="notes" />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Add deliverable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
