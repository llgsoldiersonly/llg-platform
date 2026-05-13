'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export type FirmOption = {
  id: string
  firm_name: string
  status: string
  is_demo_only: boolean
}

// Compact dropdown in the client portal topbar — only rendered when the
// current viewer is agency staff. Selecting a firm rewrites the URL with
// ?firm=<uuid>, which getClientContext picks up to scope every page on
// the client portal to that firm.
export function StaffFirmPicker({
  firms,
  currentFirmId,
}: {
  firms: FirmOption[]
  currentFirmId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('firm', e.target.value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="relative shrink-0">
      <select
        value={currentFirmId ?? ''}
        onChange={onChange}
        className="appearance-none rounded-md border border-border-default bg-neutral-primary-soft py-1.5 pl-3 pr-8 text-sm font-medium text-heading shadow-xs transition-colors hover:bg-neutral-secondary-soft focus:outline-none focus:ring-2 focus:ring-brand-medium"
      >
        {firms.length === 0 && <option value="">No firms</option>}
        {firms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.firm_name}
            {f.status !== 'active' ? ` (${f.status})` : ''}
            {f.is_demo_only ? ' [demo]' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-body-subtle" />
    </div>
  )
}
