import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-heading">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase text-body">Email</p>
            <p className="text-heading">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Role</p>
            <Badge variant="secondary">
              {(user?.app_metadata?.role as string) ?? 'client_user'}
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Last sign-in</p>
            <p className="text-heading">
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
        <CardContent className="text-sm text-body">
          Editable name, password reset, and notification preferences are coming in v1.1. For now, contact your account manager to update profile info.
        </CardContent>
      </Card>
    </div>
  )
}
