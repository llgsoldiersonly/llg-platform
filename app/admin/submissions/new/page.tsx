import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmissionForm } from './submission-form'

export const dynamic = 'force-dynamic'

type FirmRow = { id: string; firm_name: string; status: string }
type DeliverableRow = {
  id: string
  client_id: string
  title: string
  module_code: string
  code: string
  period_start: string
  period_end: string
  target_count: number | null
  actual_count: number | null
}

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>
}) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/submissions/new')
  if (!isAgencyStaff(user)) redirect('/login?error=forbidden')

  const { client_id: preselectId } = await searchParams

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: firms }, { data: deliverables }] = await Promise.all([
    admin
      .from('clients')
      .select('id, firm_name, status')
      .neq('status', 'churned')
      .order('firm_name')
      .returns<FirmRow[]>(),
    admin
      .from('deliverables_display')
      .select('id, client_id, title, module_code, code, period_start, period_end, target_count, actual_count')
      .lte('period_start', today)
      .gte('period_end', today)
      .returns<DeliverableRow[]>(),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Submit work</h1>
        <p className="mt-1 text-sm text-body">
          Log a completed piece of work with a link. Most submissions go to a super admin
          for approval before the client sees them; social posts auto-approve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New submission</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmissionForm
            firms={firms ?? []}
            deliverables={deliverables ?? []}
            preselectedClientId={preselectId ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
