'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClientFirm } from '@/lib/actions/clients'

type PackageOption = {
  id: string
  code: string
  display_name: string
  tier_order: number
}

const STATUSES = ['prospect', 'onboarding', 'active', 'paused', 'churned'] as const
type Status = (typeof STATUSES)[number]

const selectClass =
  'mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm'

export function NewClientForm({ packages }: { packages: PackageOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [firmName, setFirmName] = useState('')
  const [primaryDomain, setPrimaryDomain] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [vertical, setVertical] = useState('')
  const [status, setStatus] = useState<Status>('onboarding')
  const [isDemoOnly, setIsDemoOnly] = useState(false)
  const [notes, setNotes] = useState('')

  const [locationLabel, setLocationLabel] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  const [packageId, setPackageId] = useState('')
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!packageId) {
      setError('Pick a package.')
      return
    }
    startTransition(async () => {
      const res = await createClientFirm({
        firm_name: firmName,
        primary_domain: primaryDomain,
        primary_contact_name: contactName,
        primary_contact_email: contactEmail,
        primary_contact_phone: contactPhone,
        vertical,
        status,
        is_demo_only: isDemoOnly,
        notes,
        location_label: locationLabel,
        location_city: city,
        location_state: state,
        package_id: packageId,
        started_at: startedAt,
      })
      if (res.ok) {
        router.push(`/admin/clients/${res.data.client_id}`)
      } else {
        setError(res.error.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Firm */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-body">Firm</legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="firm-name">Firm name *</Label>
            <Input
              id="firm-name"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Daniels Law PA"
              required
            />
          </div>
          <div>
            <Label htmlFor="primary-domain">Primary domain</Label>
            <Input
              id="primary-domain"
              value={primaryDomain}
              onChange={(e) => setPrimaryDomain(e.target.value)}
              placeholder="danielslaw.com"
            />
          </div>
          <div>
            <Label htmlFor="contact-name">Primary contact name</Label>
            <Input
              id="contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="contact-email">Primary contact email</Label>
            <Input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="contact-phone">Primary contact phone</Label>
            <Input
              id="contact-phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="vertical">Vertical</Label>
            <Input
              id="vertical"
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              placeholder="Personal Injury"
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className={selectClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={isDemoOnly}
                onChange={(e) => setIsDemoOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border-default"
              />
              Demo only (excluded from crons)
            </label>
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </fieldset>

      {/* Primary location */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-body">
          Primary location
        </legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="loc-label">Label</Label>
            <Input
              id="loc-label"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Main Office"
            />
          </div>
          <div>
            <Label htmlFor="loc-city">City *</Label>
            <Input id="loc-city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="loc-state">State *</Label>
            <Input
              id="loc-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="FL"
              required
            />
          </div>
        </div>
      </fieldset>

      {/* Subscription */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-body">
          Subscription
        </legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="package">Package *</Label>
            <select
              id="package"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">— select a package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="started-at">Start date</Label>
            <Input
              id="started-at"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create client'}
        </Button>
      </div>
    </form>
  )
}
