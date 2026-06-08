import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InviteStaffForm } from './invite-form'
import { StaffRowEditor } from './staff-row-editor'
import { GoogleAdsConnectCard } from '@/components/admin/google-ads-connect-card'

export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  full_name: string | null
  role: 'agency_staff' | 'client_user' | 'super_admin'
  title: string | null
  is_active: boolean
  department_id: string | null
  department: { name: string; slug: string } | null
}

type Department = {
  id: string
  name: string
  slug: string
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ google_ads?: string; google_ads_detail?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isSuperAdmin(user)) redirect('/admin/dashboard')

  const supa = createAdminClient()

  const [profilesRes, departmentsRes, settingsRes] = await Promise.all([
    supa
      .from('profiles')
      .select('id, full_name, role, title, is_active, department_id, department:departments(name, slug)')
      .in('role', ['agency_staff', 'super_admin'])
      .order('full_name')
      .returns<Profile[]>(),
    supa
      .from('departments')
      .select('id, name, slug')
      .order('name')
      .returns<Department[]>(),
    supa
      .from('platform_settings')
      .select('google_ads_refresh_token')
      .eq('id', 1)
      .maybeSingle<{ google_ads_refresh_token: string | null }>(),
  ])

  const profiles = profilesRes.data ?? []
  const departments = departmentsRes.data ?? []
  const isGoogleAdsConnected = !!settingsRes.data?.google_ads_refresh_token
  const googleAdsFlash = sp.google_ads
    ? { kind: sp.google_ads as 'success' | 'error', detail: sp.google_ads_detail }
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Staff users</h1>
        <p className="mt-1 text-sm text-body">
          Manage who can access the admin side of the platform. Invitees receive a
          magic-link email from Supabase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active staff ({profiles.filter((p) => p.is_active).length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Role</th>
                <th className="px-6 py-3 text-left font-medium">Department</th>
                <th className="px-6 py-3 text-left font-medium">Title</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-3 font-medium text-heading">{p.full_name ?? '—'}</td>
                  <td className="px-6 py-3">
                    <Badge variant={p.role === 'super_admin' ? 'destructive' : 'secondary'}>
                      {p.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-body">{p.department?.name ?? '—'}</td>
                  <td className="px-6 py-3 text-body">{p.title ?? '—'}</td>
                  <td className="px-6 py-3">
                    {p.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <StaffRowEditor profile={p} departments={departments} />
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-body">
                    No staff users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a new staff user</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteStaffForm departments={departments} />
        </CardContent>
      </Card>

      <GoogleAdsConnectCard
        isConnected={isGoogleAdsConnected}
        flash={googleAdsFlash}
      />
    </div>
  )
}
