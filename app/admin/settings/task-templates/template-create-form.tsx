'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { createTaskTemplate } from '@/lib/actions/task-templates'

export function TemplateCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [stepsText, setStepsText] = useState('')

  function onSubmit(formData: FormData) {
    setError(null)
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (steps.length === 0) {
      setError('Add at least one step (one per line).')
      return
    }
    startTransition(async () => {
      const res = await createTaskTemplate(
        String(formData.get('name') ?? ''),
        String(formData.get('kind') ?? 'generic'),
        steps
      )
      if (!res.ok) setError(res.error.message)
      else {
        setStepsText('')
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
        <Label htmlFor="steps">Steps — one per line</Label>
        <textarea
          id="steps"
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          rows={7}
          placeholder={'Keyword Research & Content Planning\nSEO Content Writing\nInternal Review & SEO Quality Check\nClient Review & Content Approval\nContent Upload & On-Page SEO'}
          className="w-full rounded-md border border-border-default bg-bg-default p-2.5 text-sm text-heading"
        />
      </div>
      {error && <p className="text-sm text-fg-danger">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create template'}
      </Button>
    </form>
  )
}
