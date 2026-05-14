'use client'

import { useRef } from 'react'
import { Eye } from 'lucide-react'
import { startImpersonationFormAction } from '@/lib/actions/impersonation'

type Firm = {
  id: string
  firm_name: string
  is_demo_only: boolean
}

// Compact "View as client" dropdown for the admin topbar. Super_admin only.
// Pick a firm → server action sets the impersonation cookie + redirects to
// /overview, so admin lands on the client portal pinned to that firm.
export function ImpersonatePicker({ firms }: { firms: Firm[] }) {
  const formRef = useRef<HTMLFormElement>(null)

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!e.target.value) return
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} action={startImpersonationFormAction} className="flex items-center gap-2">
      <Eye className="h-4 w-4 text-body-subtle" aria-hidden="true" />
      <select
        name="client_id"
        defaultValue=""
        onChange={onChange}
        className="h-9 rounded-md border border-border-default-medium bg-neutral-primary-soft px-3 text-sm text-heading shadow-xs transition-colors hover:bg-neutral-secondary-soft focus:outline-none focus:ring-2 focus:ring-brand-medium"
        aria-label="View as client"
      >
        <option value="" disabled>
          View as client…
        </option>
        {firms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.firm_name}
            {f.is_demo_only ? ' [demo]' : ''}
          </option>
        ))}
      </select>
    </form>
  )
}
