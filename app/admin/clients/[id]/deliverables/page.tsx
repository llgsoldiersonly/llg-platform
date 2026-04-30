import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AddCustomDeliverableButton } from './add-custom-button'
import { DeliverableRowActions } from './row-actions'

export const dynamic = 'force-dynamic'

type DeliverableRow = {
  id: string
  source: 'package' | 'incentive' | 'custom'
  is_incentive: boolean
  template_id: string | null
  status: string
  actual_count: number
  period_start: string
  period_end: string
  notes: string | null
  custom_title: string | null
  custom_description: string | null
  custom_department_slug: string | null
  custom_frequency: string | null
  custom_target_count: number | null
  custom_target_unit: string | null
  template: {
    code: string
    display_name: string
    department_slug: string
    frequency: string
    target_count: number | null
    target_unit: string | null
    tracking_source: string
  } | null
  subscription: {
    id: string
    package: { code: string; display_name: string } | null
  }
}

type Subscription = {
  id: string
  package: { code: string; display_name: string } | null
}

const sourceBadge = {
  package: { variant: 'secondary' as const, label: 'Package' },
  incentive: { variant: 'success' as const, label: 'Free Bonus' },
  custom: { variant: 'info' as const, label: 'Custom' },
}

const statusBadge: Record<string, 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'info',
  done: 'success',
  skipped: 'warning',
  blocked: 'destructive',
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
          <h2 className="text-lg font-semibold text-slate-900">Deliverables</h2>
          <p className="mt-1 text-sm text-slate-600">
            {deliverables.length} tracked items — package items + custom/incentive add-ons
          </p>
        </div>
        <AddCustomDeliverableButton clientId={id} subscriptions={subscriptions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All deliverables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deliverables.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              No deliverables yet. They'll be auto-generated as subscriptions roll into a new period, or you can add a custom one above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Item</th>
                  <th className="px-6 py-3 text-left font-medium">Source</th>
                  <th className="px-6 py-3 text-left font-medium">Period</th>
                  <th className="px-6 py-3 text-left font-medium">Progress</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliverables.map((d) => {
                  const title = d.template?.display_name ?? d.custom_title ?? '—'
                  const target = d.template?.target_count ?? d.custom_target_count ?? 0
                  const unit = d.template?.target_unit ?? d.custom_target_unit ?? ''
                  const source = sourceBadge[d.source]
                  const statusVar = statusBadge[d.status] ?? 'secondary'
                  const tracking = d.template?.tracking_source ?? 'manual'
                  return (
                    <tr key={d.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{title}</div>
                        <div className="text-xs text-slate-600">
                          {d.subscription.package?.code ?? '—'}
                          {d.template?.department_slug && (
                            <> · {d.template.department_slug}</>
                          )}
                          {d.custom_department_slug && (
                            <> · {d.custom_department_slug}</>
                          )}
                          {tracking !== 'manual' && (
                            <> · auto: {tracking}</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={source.variant}>{source.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {d.period_start} → {d.period_end}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {d.actual_count} / {target} {unit}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVar}>{d.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DeliverableRowActions
                          deliverableId={d.id}
                          clientId={id}
                          status={d.status}
                          isCustom={d.template_id === null}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
