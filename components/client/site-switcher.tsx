'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/select'
import type { ClientSite } from '@/lib/client-context'

type Props = {
  sites: ClientSite[]
}

// Only renders when there's >1 tracked website. Reads/writes the ?site=
// search param so every page can pass it to getClientContext() and re-render
// the SEO data (rankings / backlinks / site health) for the chosen site.
export function SiteSwitcher({ sites }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (sites.length <= 1) return null

  const currentId =
    searchParams.get('site') ??
    sites.find((s) => s.is_primary)?.id ??
    sites[0]?.id ??
    ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('site', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentId} onChange={handleChange} aria-label="Switch website" className="w-56">
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.domain}
          {s.is_primary ? ' (primary)' : ''}
        </option>
      ))}
    </Select>
  )
}
