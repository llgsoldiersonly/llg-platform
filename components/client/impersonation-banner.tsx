import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveImpersonation } from '@/lib/impersonation'
import { stopImpersonationFormAction } from '@/lib/actions/impersonation'

// Banner that appears at the top of the client portal whenever a super-admin
// has an active impersonation session. Renders nothing when not impersonating
// (so it can be safely placed in the layout for both real client_users and
// staff in normal QA mode).
export async function ImpersonationBanner() {
  const active = await getActiveImpersonation()
  if (!active) return null

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('clients')
    .select('firm_name')
    .eq('id', active.clientId)
    .maybeSingle()

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <span>
          You are viewing as <strong>{client?.firm_name ?? 'this client'}</strong>. Your
          actions are recorded.
        </span>
        <form action={stopImpersonationFormAction}>
          <button
            type="submit"
            className="rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  )
}
