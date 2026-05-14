'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SUBMISSION_KINDS } from '@/lib/submissions/kinds'
import { X } from 'lucide-react'

export type FirmOption = { id: string; firm_name: string }

// URL-driven filter bar for the admin submissions audit log. Each filter
// writes back to ?firm/?kind/?status/?since and the server-rendered page
// re-runs its query. No client state — the URL IS the state, which means
// filters survive refresh and are bookmarkable.
export function SubmissionsFilterBar({
  firms,
  current,
}: {
  firms: FirmOption[]
  current: {
    firm: string
    kind: string
    status: string
    since: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    router.push(`${pathname}?${next.toString()}`)
  }

  function clearAll() {
    router.push(pathname)
  }

  const anyActive =
    current.firm !== 'all' ||
    current.kind !== 'all' ||
    current.status !== 'active' ||
    current.since !== '30d'

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-default bg-neutral-primary-soft p-4">
      <FilterField label="Firm">
        <Select
          value={current.firm}
          onChange={(e) => setParam('firm', e.target.value)}
          className="h-9 text-sm"
        >
          <option value="all">All firms</option>
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.firm_name}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="Kind">
        <Select
          value={current.kind}
          onChange={(e) => setParam('kind', e.target.value)}
          className="h-9 text-sm"
        >
          <option value="all">All kinds</option>
          {SUBMISSION_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="Status">
        <Select
          value={current.status}
          onChange={(e) => setParam('status', e.target.value)}
          className="h-9 text-sm"
        >
          <option value="active">Active only</option>
          <option value="all">Active + replaced</option>
          <option value="replaced">Replaced only</option>
        </Select>
      </FilterField>

      <FilterField label="Date">
        <Select
          value={current.since}
          onChange={(e) => setParam('since', e.target.value)}
          className="h-9 text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </FilterField>

      {anyActive && (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="ml-auto">
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-body-subtle">{label}</Label>
      {children}
    </div>
  )
}
