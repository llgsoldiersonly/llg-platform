import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { getClientContext } from '@/lib/client-context'
import { ClientHeader } from '@/components/client/header'
import { ImpersonationBanner } from '@/components/client/impersonation-banner'

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Staff hitting client URLs (e.g. for QA): allow through. The header's
  // wordmark + impersonation banner make the QA context obvious.
  if (!isAgencyStaff(user)) {
    const ctx = await getClientContext()
    if (!ctx) {
      // Authenticated user with no client membership and no staff role —
      // dead-end. Send them to login with an explanation.
      redirect('/login?error=no_client_access')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-secondary-soft">
      <ImpersonationBanner />
      <ClientHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}
