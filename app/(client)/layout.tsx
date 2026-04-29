import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { getClientContext } from '@/lib/client-context'
import { ClientSidebar } from '@/components/client/sidebar'
import { ClientTopbar } from '@/components/client/topbar'
import { ImpersonationBanner } from '@/components/client/impersonation-banner'

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Staff hitting client URLs (e.g. for QA): allow through, but the firm
  // name on the sidebar will fall back to a placeholder.
  let firmName = 'Your firm'

  if (!isAgencyStaff(user)) {
    const ctx = await getClientContext()
    if (!ctx) {
      // Authenticated user with no client membership and no staff role —
      // dead-end. Send them to login with an explanation.
      redirect('/login?error=no_client_access')
    }
    firmName = ctx.client.firm_name
  } else {
    const ctx = await getClientContext()
    firmName = ctx?.client.firm_name ?? 'QA — staff view'
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <ClientSidebar firmName={firmName} />
      <div className="flex min-h-screen flex-1 flex-col">
        <ClientTopbar />
        <ImpersonationBanner />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
