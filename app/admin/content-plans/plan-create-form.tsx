'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { createContentPlan, type PlanRowInput } from '@/lib/actions/content-plans'

type Client = { id: string; firm_name: string }
type Department = { id: string; name: string }

// Parse pasted rows. Accepts tab- or comma-separated columns in the order
// Keyword · Practice Area · Tier · Target URL (extra columns ignored). A line
// with just a keyword is fine. Header rows like "Keyword,Practice Area,Tier"
// are skipped.
function parseRows(text: string): PlanRowInput[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim()))
    .filter((cols) => cols[0] && cols[0].toLowerCase() !== 'keyword')
    .map((cols) => ({
      keyword: cols[0],
      practice_area: cols[1] || null,
      tier: cols[2] || null,
      target_slug: cols[3] || null,
    }))
}

export function PlanCreateForm({
  clients,
  departments,
}: {
  clients: Client[]
  departments: Department[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rowsText, setRowsText] = useState('')

  const parsedCount = parseRows(rowsText).length

  function onSubmit(formData: FormData) {
    setError(null)
    const rows = parseRows(rowsText)
    if (rows.length === 0) {
      setError('Paste at least one row (keyword required).')
      return
    }
    startTransition(async () => {
      const res = await createContentPlan({
        client_id: String(formData.get('client_id') ?? ''),
        name: String(formData.get('name') ?? ''),
        kind: formData.get('kind') as 'blog' | 'seo_page' | 'sitemap',
        department_id: (formData.get('department_id') as string) || null,
        rows,
      })
      if (!res.ok) {
        setError(res.error.message)
      } else {
        router.push(`/admin/content-plans/${res.data.id}`)
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client_id">Client</Label>
          <Select id="client_id" name="client_id" required defaultValue="">
            <option value="" disabled>Pick a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.firm_name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Plan name</Label>
          <Input id="name" name="name" required placeholder="e.g. E.N. Banks-Ware — SEO Pages" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind" defaultValue="seo_page">
            <option value="seo_page">SEO pages</option>
            <option value="blog">Blog</option>
            <option value="sitemap">Sitemap</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="department_id">Department (optional)</Label>
          <Select id="department_id" name="department_id" defaultValue="">
            <option value="">— none —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rows">
          Rows <span className="font-normal text-body-subtle">— paste from your sheet</span>
        </Label>
        <textarea
          id="rows"
          value={rowsText}
          onChange={(e) => setRowsText(e.target.value)}
          rows={8}
          placeholder={
            'Keyword\tPractice Area\tTier\n' +
            'Family law attorney DeKalb County Georgia\tFamily Law\tTier 1 Core\n' +
            'Divorce lawyer DeKalb County Georgia\tDivorce\tTier 2 Practice'
          }
          className="w-full rounded-md border border-border-default bg-bg-default p-2.5 font-mono text-xs text-heading"
        />
        <p className="text-xs text-body-subtle">
          One row per line. Columns: <strong>Keyword · Practice Area · Tier · Target URL</strong>{' '}
          (tab or comma separated). A header line is ignored. {parsedCount > 0 && (
            <span className="text-fg-brand">{parsedCount} row{parsedCount === 1 ? '' : 's'} detected.</span>
          )}
        </p>
      </div>

      {error && <p className="text-sm text-fg-danger">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create plan'}
      </Button>
    </form>
  )
}
