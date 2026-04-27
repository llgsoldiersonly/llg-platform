'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/select'
import type { ClientLocation } from '@/lib/client-context'

type Props = {
  locations: ClientLocation[]
}

// Only renders when there's >1 location. Reads/writes ?location= search
// param so every page can pass it to getClientContext() and re-render
// against the chosen location.
export function LocationSwitcher({ locations }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (locations.length <= 1) return null

  const currentId =
    searchParams.get('location') ??
    locations.find((l) => l.is_primary)?.id ??
    locations[0]?.id ??
    ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('location', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select
      value={currentId}
      onChange={handleChange}
      aria-label="Switch location"
      className="w-56"
    >
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label} ({l.city}, {l.state})
        </option>
      ))}
    </Select>
  )
}
