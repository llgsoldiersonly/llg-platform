import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Admin Dashboard</h1>
      <p className="mb-8 text-sm text-slate-600">
        Signed in as <strong>{user?.email}</strong>
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-300">—</p>
            <p className="text-xs text-slate-500">wired in Phase 3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-300">—</p>
            <p className="text-xs text-slate-500">wired in Phase 5</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sync Errors (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-300">—</p>
            <p className="text-xs text-slate-500">wired in Phase 6</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
