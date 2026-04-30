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
    <div className="bg-brand-strong px-4 py-3 text-sm text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <span>
          You&apos;re viewing as <strong>{client?.firm_name ?? 'this client'}</strong>
          {' '}— your actions are recorded.
        </span>
        <form action={stopImpersonationFormAction}>
          <button
            type="submit"
            className="rounded-md border border-white/30 bg-neutral-primary-soft/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-primary-soft/20"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  )
}
