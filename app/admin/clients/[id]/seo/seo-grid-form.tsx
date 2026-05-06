'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { seedSquareMapGrid } from '@/lib/actions/dataforseo-seeding'

type Location = { id: string; label: string; city: string; state: string; lat: number | null; lng: number | null }

export function MapGridForm({
  clientId,
  locations,
  existingCount,
}: {
  clientId: string
  locations: Location[]
  existingCount: number
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [locationId, setLocationId] = useState('')
  const [size, setSize] = useState<3 | 5 | 7>(5)
  const [stepMiles, setStepMiles] = useState(1)

  const selected = locations.find((l) => l.id === locationId)
  const lat = selected?.lat ?? null
  const lng = selected?.lng ?? null
  const ready = !!selected && lat !== null && lng !== null

  function handleSeed() {
    setError(null)
    setSuccess(null)
    if (!ready || lat === null || lng === null) {
      setError('Pick a location with lat/lng set on the Summary tab first.')
      return
    }
    startTransition(async () => {
      const res = await seedSquareMapGrid({
        client_id: clientId,
        client_location_id: locationId,
        centerLat: Number(lat),
        centerLng: Number(lng),
        size,
        stepMiles,
      })
      if (res.ok) setSuccess(`Seeded ${res.data.inserted} grid point${res.data.inserted === 1 ? '' : 's'}`)
      else setError(res.error.message)
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <Label htmlFor="grid-loc">Location</Label>
          <select
            id="grid-loc"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
          >
            <option value="">— pick one —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id} disabled={l.lat === null || l.lng === null}>
                {l.label} ({l.city}, {l.state}){l.lat === null ? ' — no lat/lng' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="grid-size">Grid size</Label>
          <select
            id="grid-size"
            value={size}
            onChange={(e) => setSize(Number(e.target.value) as 3 | 5 | 7)}
            className="mt-1 block w-full rounded border border-border-default bg-bg-base px-2 py-1.5 text-sm"
          >
            <option value={3}>3 × 3 (9 points)</option>
            <option value={5}>5 × 5 (25 points)</option>
            <option value={7}>7 × 7 (49 points)</option>
          </select>
        </div>
        <div>
          <Label htmlFor="grid-step">Step (miles)</Label>
          <Input
            id="grid-step"
            type="number"
            min={0.25}
            max={10}
            step={0.25}
            value={stepMiles}
            onChange={(e) => setStepMiles(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={handleSeed} disabled={pending || !ready} className="w-full">
            {pending ? 'Seeding…' : existingCount > 0 ? 'Add more points' : 'Seed grid'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-body">
        Each point becomes one Google Maps rank check per high-priority keyword on the weekly cron. A 5×5 with 4 keywords costs
        25 × 4 × $0.002 ≈ <strong>$0.20/week</strong>.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
    </div>
  )
}
