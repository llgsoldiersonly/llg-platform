'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { createTaskTemplate, type TemplateStepInput } from '@/lib/actions/task-templates'

type Staff = { id: string; name: string }

type StepDraft = {
  title: string
  assignee_rule: 'unassigned' | 'parent_assignee' | 'department_lead' | 'specific'
  assignee_id: string
  offset_days: string
}

const EMPTY_STEP: StepDraft = { title: '', assignee_rule: 'unassigned', assignee_id: '', offset_days: '' }

export function TemplateCreateForm({ staff }: { staff: Staff[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<StepDraft[]>([{ ...EMPTY_STEP }, { ...EMPTY_STEP }, { ...EMPTY_STEP }])

  function setStep(i: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function onSubmit(formData: FormData) {
    setError(null)
    const payload: TemplateStepInput[] = steps
      .filter((s) => s.title.trim())
      .map((s) => ({
        title: s.title,
        assignee_rule: s.assignee_rule,
        assignee_id: s.assignee_rule === 'specific' ? s.assignee_id || null : null,
        offset_days: s.offset_days.trim() === '' ? null : Number(s.offset_days),
      }))
    if (payload.length === 0) {
      setError('Add at least one step.')
      return
    }
    startTransition(async () => {
      const res = await createTaskTemplate(
        String(formData.get('name') ?? ''),
        String(formData.get('kind') ?? 'generic'),
        payload
      )
      if (!res.ok) setError(res.error.message)
      else {
        setSteps([{ ...EMPTY_STEP }, { ...EMPTY_STEP }, { ...EMPTY_STEP }])
        router.refresh()
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Template name</Label>
          <Input id="name" name="name" required placeholder="e.g. SEO page workflow" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind" defaultValue="generic">
            <option value="generic">Generic</option>
            <option value="blog">Blog</option>
            <option value="seo_page">SEO page</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Steps — in order</Label>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border-default p-2">
              <span className="w-6 shrink-0 text-center text-xs text-body-subtle">{i + 1}</span>
              <Input
                value={s.title}
                onChange={(e) => setStep(i, { title: e.target.value })}
                placeholder="Step title, e.g. SEO Content Writing"
                className="min-w-48 flex-1"
              />
              <Select
                value={s.assignee_rule}
                onChange={(e) => setStep(i, { assignee_rule: e.target.value as StepDraft['assignee_rule'] })}
                className="w-44 text-xs"
                aria-label="Who does this step"
              >
                <option value="unassigned">Unassigned</option>
                <option value="parent_assignee">Parent&apos;s assignee</option>
                <option value="department_lead">Department lead</option>
                <option value="specific">Specific person…</option>
              </Select>
              {s.assignee_rule === 'specific' && (
                <Select
                  value={s.assignee_id}
                  onChange={(e) => setStep(i, { assignee_id: e.target.value })}
                  className="w-40 text-xs"
                  aria-label="Person"
                >
                  <option value="">Pick person…</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
              <div className="flex items-center gap-1">
                <span className="text-xs text-body-subtle">due +</span>
                <Input
                  type="number"
                  min="0"
                  value={s.offset_days}
                  onChange={(e) => setStep(i, { offset_days: e.target.value })}
                  placeholder="—"
                  className="w-16 text-xs"
                  aria-label="Due days after start"
                />
                <span className="text-xs text-body-subtle">days</span>
              </div>
              <button
                type="button"
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-body-subtle hover:text-fg-danger"
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSteps((prev) => [...prev, { ...EMPTY_STEP }])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add step
        </Button>
        <p className="text-xs text-body-subtle">
          &ldquo;Due +N days&rdquo; counts from the parent task&apos;s start date (or the day the
          workflow is applied). Only the first assigned step is notified up front — later steps get
          pinged automatically when the previous one completes.
        </p>
      </div>

      {error && <p className="text-sm text-fg-danger">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create template'}
      </Button>
    </form>
  )
}
