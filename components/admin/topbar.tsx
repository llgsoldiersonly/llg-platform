import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientSwitcher } from './client-switcher'
import { ImpersonatePicker } from './impersonate-picker'
import { NotificationsBell } from '@/components/notifications-bell'
import { signOutAction } from '@/lib/actions/auth'

export async function AdminTopbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const [{ data: clients }, { data: profile }] = await Promise.all([
    admin
      .from('clients')
      .select('id, firm_name, is_demo_only')
      .order('is_demo_only', { ascending: true })
      .order('firm_name', { ascending: true }),
    user
      ? admin
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle<{ full_name: string | null; role: string | null }>()
      : Promise.resolve({ data: null }),
  ])

  const displayName = profile?.full_name ?? user?.email ?? 'Staff'
  const role = (profile?.role ?? user?.app_metadata?.role) as string | null
  const initial = (displayName[0] ?? 'S').toUpperCase()
  const isSuper = role === 'super_admin'

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-neutral-primary-soft px-6">
      <ClientSwitcher clients={clients ?? []} />
      <div className="flex shrink-0 items-center gap-3">
        {isSuper && <ImpersonatePicker firms={clients ?? []} />}
        {isSuper && <Badge variant="brand" className="hidden sm:inline-flex">Super admin</Badge>}
        <NotificationsBell />
        <div className="flex items-center gap-2 rounded-pill border border-border-default bg-neutral-primary-soft px-3 py-1.5 shadow-xs">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-fg-brand-strong">
            {initial}
          </span>
          <div className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium text-heading">{displayName}</span>
            <span className="block text-[10px] uppercase tracking-wide text-body-subtle">
              {role ?? 'staff'}
            </span>
          </div>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
