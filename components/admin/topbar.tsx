import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { ClientSwitcher } from './client-switcher'
import { signOutAction } from '@/lib/actions/auth'

export async function AdminTopbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: clients } = await admin
    .from('clients')
    .select('id, firm_name, is_demo_only')
    .order('is_demo_only', { ascending: true })
    .order('firm_name', { ascending: true })

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <ClientSwitcher clients={clients ?? []} />
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-600">{user?.email}</span>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
