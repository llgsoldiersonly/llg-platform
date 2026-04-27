import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase text-slate-500">Email</p>
            <p className="text-slate-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Role</p>
            <Badge variant="secondary">
              {(user?.app_metadata?.role as string) ?? 'client_user'}
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Last sign-in</p>
            <p className="text-slate-900">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          Editable name, password reset link, and notification preferences ship in Phase 10.
        </CardContent>
      </Card>
    </div>
  )
}
