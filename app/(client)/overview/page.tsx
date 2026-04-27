import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ClientOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Welcome back</h1>
      <p className="mb-8 text-sm text-slate-600">
        Signed in as <strong>{user?.email}</strong>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Your dashboard modules will appear here once Phase 4 ships.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
