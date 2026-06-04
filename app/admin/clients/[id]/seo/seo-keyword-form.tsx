'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addTrackedKeyword,
  bulkAddKeywordTemplates,
} from '@/lib/actions/dataforseo-seeding'
import { PRACTICE_AREA_LABELS, type PracticeArea } from '@/lib/seo/keywordTemplates'

type Location = { id: string; label: string; city: string; state: string }
type Site = { id: string; domain: string; is_primary: boolean }

export function KeywordForm({
  clientId,
  locations,
  sites = [],
}: {
  clientId: string
  locations: Location[]
  sites?: Site[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const defaultSiteId = sites.find((s) => s.is_primary)?.id ?? sites[0]?.id ?? ''
  const multiSite = sites.length > 1

  // Single-add fields
  const [keyword, setKeyword] = useState('')
  const [searchType, setSearchType] = useState<'organic' | 'local_pack' | 'maps' | 'ai_mode'>('organic')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [locationId, setLocationId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>(defaultSiteId)

  // Bulk fields
  const [practiceArea, setPracticeArea] = useState<PracticeArea>('personal_injury')
  const [bulkLocationId, setBulkLocationId] = useState<string>('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const loc = locations.find((l) => l.id === locationId)
    startTransition(async () => {
      const res = await addTrackedKeyword({
        client_id: clientId,
        client_location_id: locationId || null,
        site_id: siteId || null,
        keyword,
        city: loc?.city ?? null,
        state: loc?.state ?? null,
        location_name: loc ? `${loc.city},${loc.state},United States` : null,
        search_type: searchType,
        priority,
      })
      if (res.ok) {
        setKeyword('')
        setSuccess('Keyword added')
      } else {
        setError(res.error.message)
      }
    })
  }

  function handleBulk() {
    setError(null)
    setSuccess(null)
    const loc = locations.find((l) => l.id === bulkLocationId)
    if (!loc) {
      setError('Pick a location for the bulk seed.')
      return
    }
    startTransition(async () => {
      const res = await bulkAddKeywordTemplates({
        client_id: clientId,
        client_location_id: loc.id,
        site_id: siteId || null,
        practice_area: practiceArea,
        city: loc.city,
        state: loc.state,
        search_type: 'organic',
        priority: 'medium',
      })
      if (res.ok) setSuccess(`Added ${res.data.inserted} keyword${res.data.inserted === 1 ? '' : 's'}`)
      else setError(res.error.message)
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="kw-keyword">Keyword</Label>
          <Input
            id="kw-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="personal injury lawyer dallas"
            required
          />
        </div>
        <div>
          <Label htmlFor="kw-type">Search type</Label>
          <select
            id="kw-type"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as typeof searchType)}
            className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
          >
            <option value="organic">organic</option>
            <option value="local_pack">local_pack</option>
            <option value="maps">maps</option>
            <option value="ai_mode">ai_mode</option>
          </select>
        </div>
        <div>
          <Label htmlFor="kw-priority">Priority</Label>
          <select
            id="kw-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
          >
            <option value="high">high (weekly)</option>
            <option value="medium">medium (weekly)</option>
            <option value="low">low (monthly)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="kw-loc">Location</Label>
          <select
            id="kw-loc"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
          >
            <option value="">— none —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} ({l.city}, {l.state})
              </option>
            ))}
          </select>
        </div>
        {multiSite && (
          <div>
            <Label htmlFor="kw-site">Website</Label>
            <select
              id="kw-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain}
                  {s.is_primary ? ' (primary)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Adding…' : 'Add keyword'}
          </Button>
        </div>
      </form>

      <div className="rounded border border-border-default bg-neutral-tertiary-soft p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-body">
          Bulk-import from law-firm template
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Label htmlFor="bk-area">Practice area</Label>
            <select
              id="bk-area"
              value={practiceArea}
              onChange={(e) => setPracticeArea(e.target.value as PracticeArea)}
              className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            >
              {Object.entries(PRACTICE_AREA_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <Label htmlFor="bk-loc">Location for {'{city}'}</Label>
            <select
              id="bk-loc"
              value={bulkLocationId}
              onChange={(e) => setBulkLocationId(e.target.value)}
              className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            >
              <option value="">— pick one —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.city}, {l.state}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={handleBulk}
            disabled={pending || !bulkLocationId}
            variant="secondary"
          >
            {pending ? 'Adding…' : 'Bulk add'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
    </div>
  )
}
