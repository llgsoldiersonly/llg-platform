import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StaffSubmitForm } from './staff-submit-form'

export const dynamic = 'force-dynamic'

type FirmRow = { id: string; firm_name: string; status: string }
type DeliverableRow = {
  id: string
  client_id: string
  title: string
  module_code: string
  period_start: string
  period_end: string
  target_count: number | null
  actual_count: number | null
}

export default async function StaffHomePage() {
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
      .select('id, client_id, title, module_code, period_start, period_end, target_count, actual_count')
      .lte('period_start', today)
      .gte('period_end', today)
      .returns<DeliverableRow[]>(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Submit work</h1>
        <p className="mt-1 text-sm text-body">
          Log a completed piece of work with a link. The client sees it immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New submission</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffSubmitForm firms={firms ?? []} deliverables={deliverables ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
