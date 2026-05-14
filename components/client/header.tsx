import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LlgWordmark } from '@/components/brand/logo'
import { LocationSwitcher } from './location-switcher'
import { ClientTopNav } from './top-nav'
import { signOutAction } from '@/lib/actions/auth'
import { getClientContext } from '@/lib/client-context'

// Top-of-page header for the client portal. Clients only — agency_staff
// and super_admin live in entirely separate portals (/staff and /admin)
// and never reach this header.
export async function ClientHeader() {
  const ctx = await getClientContext()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firmName = ctx?.client.firm_name ?? 'Your firm'
  const initial = (firmName[0] ?? 'C').toUpperCase()

  return (
    <header className="border-b border-border-default bg-neutral-primary-soft">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/overview" className="shrink-0">
          <LlgWordmark size="md" />
        </Link>

        <ClientTopNav />

        <div className="flex shrink-0 items-center gap-3">
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
