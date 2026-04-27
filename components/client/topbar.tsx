import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LocationSwitcher } from './location-switcher'
import { signOutAction } from '@/lib/actions/auth'
import { getClientContext } from '@/lib/client-context'

export async function ClientTopbar() {
  const ctx = await getClientContext()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        {ctx?.client.is_demo_only && <Badge variant="warning">DEMO</Badge>}
        {ctx && <LocationSwitcher locations={ctx.locations} />}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">{user?.email}</span>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
