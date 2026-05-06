'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addCompetitor } from '@/lib/actions/dataforseo-seeding'

export function CompetitorForm({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [gbpName, setGbpName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await addCompetitor({
        client_id: clientId,
        competitor_name: name,
        competitor_domain: domain || null,
        google_business_profile_name: gbpName || null,
        city: city || null,
        state: state || null,
      })
      if (res.ok) {
        setName('')
        setDomain('')
        setGbpName('')
        setSuccess('Competitor added')
      } else {
        setError(res.error.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="md:col-span-2">
        <Label htmlFor="cmp-name">Firm name</Label>
        <Input id="cmp-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="cmp-domain">Domain</Label>
        <Input
          id="cmp-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="competitor.com"
        />
      </div>
      <div>
        <Label htmlFor="cmp-city">City</Label>
        <Input id="cmp-city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="cmp-state">State</Label>
        <Input
          id="cmp-state"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="TX"
          maxLength={2}
        />
      </div>
      <div className="md:col-span-4">
        <Label htmlFor="cmp-gbp">GBP listing name (optional, helps map matching)</Label>
        <Input id="cmp-gbp" value={gbpName} onChange={(e) => setGbpName(e.target.value)} />
      </div>
      <div className="md:col-span-2 flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Adding…' : 'Add competitor'}
        </Button>
      </div>
      {error && <p className="md:col-span-6 text-sm text-red-600">{error}</p>}
      {success && <p className="md:col-span-6 text-sm text-emerald-600">{success}</p>}
    </form>
  )
}
