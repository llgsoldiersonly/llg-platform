import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LlgWordmark } from '@/components/brand/logo'
import { LocationSwitcher } from './location-switcher'
import { ClientTopNav } from './top-nav'
import { StaffFirmPicker, type FirmOption } from './staff-firm-picker'
import { signOutAction } from '@/lib/actions/auth'
import { getClientContext } from '@/lib/client-context'
import { isAgencyStaff } from '@/lib/auth/rbac'

// Top-of-page header for the client portal — replaces the old sidebar +
// thin topbar combo. Layout matches the brand reference: wordmark + tagline
// on the left, top-nav tabs in the middle, user/firm card + sign-out on
// the right. The nav itself is a client component because it needs the
// active-route highlight; everything else stays server-rendered.
export async function ClientHeader() {
  const ctx = await getClientContext()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firmName = ctx?.client.firm_name ?? 'Your firm'
  const initial = (firmName[0] ?? 'C').toUpperCase()

  // For staff: load the list of firms they can switch between. Service-role
  // query because agency_staff doesn't have client_users membership rows.
  let staffFirms: FirmOption[] = []
  if (user && isAgencyStaff(user)) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('clients')
      .select('id, firm_name, status, is_demo_only')
      .neq('status', 'churned')
      .order('firm_name', { ascending: true })
      .returns<FirmOption[]>()
    staffFirms = data ?? []
  }

  return (
    <header className="border-b border-border-default bg-neutral-primary-soft">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/overview" className="shrink-0">
          <LlgWordmark size="md" />
        </Link>

        <ClientTopNav />

        <div className="flex shrink-0 items-center gap-3">
          {staffFirms.length > 0 && (
            <StaffFirmPicker firms={staffFirms} currentFirmId={ctx?.client.id ?? null} />
          )}
          {ctx?.client.is_demo_only && <Badge variant="warning">DEMO</Badge>}
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 transition-colors hover:bg-neutral-secondary-soft"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-fg-brand">
              {initial}
            </span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-medium text-heading">{firmName}</span>
              <span className="block text-[10px] uppercase tracking-wide text-body">
                {(user?.app_metadata?.role as string) ?? 'client'}
              </span>
            </span>
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {ctx && ctx.locations.length > 1 && (
        <div className="border-t border-border-light bg-neutral-secondary-soft/60 px-6 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-end">
            <LocationSwitcher locations={ctx.locations} />
          </div>
        </div>
      )}
    </header>
  )
}
