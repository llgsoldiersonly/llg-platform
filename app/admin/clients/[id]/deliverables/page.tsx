import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { AddCustomDeliverableButton } from './add-custom-button'
import { GenerateDeliverablesButton } from './generate-button'
import { DeliverablesTabs, type DeliverableRow } from './deliverables-tabs'

export const dynamic = 'force-dynamic'

type Subscription = {
  id: string
  package: { code: string; display_name: string } | null
}

export default async function ClientDeliverablesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, deliverablesRes, subscriptionsRes] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa
      .from('deliverables')
      .select(`
        id, source, is_incentive, template_id, status, actual_count, period_start, period_end, notes,
        custom_title, custom_description, custom_department_slug, custom_frequency, custom_target_count, custom_target_unit,
        template:package_deliverables(code, display_name, department_slug, frequency, target_count, target_unit, tracking_source),
        subscription:subscriptions!inner(id, client_id, package:package_templates(code, display_name))
      `)
      .eq('subscription.client_id', id)
      .order('period_start', { ascending: false })
      .order('source', { ascending: true })
      .returns<DeliverableRow[]>(),
    supa
      .from('subscriptions')
      .select('id, package:package_templates(code, display_name)')
      .eq('client_id', id)
      .returns<Subscription[]>(),
  ])

  if (!client) notFound()

  const deliverables = deliverablesRes.data ?? []
  const subscriptions = subscriptionsRes.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-heading">Deliverables</h2>
          <p className="mt-1 text-sm text-body">
            {deliverables.length} tracked items — package items + custom/incentive add-ons
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateDeliverablesButton clientId={id} />
          <AddCustomDeliverableButton clientId={id} subscriptions={subscriptions} />
        </div>
      </div>

      <DeliverablesTabs deliverables={deliverables} clientId={id} />
    </div>
  )
}
