import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getModuleComponent, MODULE_RENDER_ORDER, type ModuleCode } from '@/components/package-modules/registry'

export const dynamic = 'force-dynamic'

type DeliverableDisplay = {
  id: string
  title: string
  source: 'package' | 'incentive' | 'custom'
  is_incentive: boolean
  module_code: string
  status: string
  actual_count: number
  target_count: number | null
  target_unit: string | null
  frequency: string | null
  client_visible: boolean
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') sp.set(k, v)
  }

  const ctx = await getClientContext(sp)
  if (!ctx) redirect('/login')

  const supabase = await createClient()

  // Pull deliverables for the selected subscriptions via the display view
  // (which coalesces template + custom rows for the UI).
  const subIds = ctx.selectedSubscriptions.map((s) => s.id)
  const { data: deliverables } = subIds.length > 0
    ? await supabase
        .from('deliverables_display')
        .select('id, title, source, is_incentive, module_code, status, actual_count, target_count, target_unit, frequency, client_visible')
        .in('subscription_id', subIds)
        .eq('client_visible', true)
        .returns<DeliverableDisplay[]>()
    : { data: [] }

  // Group deliverables by module_code
  const byModule: Record<string, DeliverableDisplay[]> = {}
  for (const d of deliverables ?? []) {
    byModule[d.module_code] = byModule[d.module_code] ?? []
    byModule[d.module_code].push(d)
  }

  // Collect modules from selected subscriptions, deduped, in render order
  const enabledModuleCodes = new Set<string>()
  const moduleConfigs: Record<string, Record<string, unknown>> = {}
  for (const sub of ctx.selectedSubscriptions) {
    for (const m of sub.modules) {
      enabledModuleCodes.add(m.module_code)
      moduleConfigs[m.module_code] = { ...moduleConfigs[m.module_code], ...m.config }
    }
  }

  const orderedModules = MODULE_RENDER_ORDER.filter((c) => enabledModuleCodes.has(c))
  const customDeliverables = byModule['CUSTOM'] ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your plan</h1>
        <p className="mt-1 text-sm text-slate-600">
          {ctx.selectedSubscriptions.length} active subscription
          {ctx.selectedSubscriptions.length === 1 ? '' : 's'}
          {ctx.selectedLocation && (
            <> · {ctx.selectedLocation.label}</>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ctx.selectedSubscriptions.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Badge variant="info">{s.package?.code ?? '—'}</Badge>
                <span className="text-sm text-slate-700">{s.package?.display_name ?? '—'}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {orderedModules.length === 0 && customDeliverables.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            No modules enabled for your current selection. If you expect to see something here, contact your account manager.
          </CardContent>
        </Card>
      )}

      {orderedModules.map((code) => {
        const Component = getModuleComponent(code)
        if (!Component) return null
        return (
          <Component
            key={code}
            config={moduleConfigs[code] ?? {}}
            deliverables={byModule[code] ?? []}
          />
        )
      })}

      {customDeliverables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonuses & extras</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {customDeliverables.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{d.title}</span>
                    <Badge variant={d.is_incentive ? 'success' : 'info'}>
                      {d.is_incentive ? 'Free Bonus' : 'Custom'}
                    </Badge>
                  </div>
                  <Badge variant="secondary">{d.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
