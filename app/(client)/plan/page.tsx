import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getModuleComponent, MODULE_RENDER_ORDER } from '@/components/package-modules/registry'
import { ModuleSection } from '@/components/package-modules/module-section'
import { PlanStatusFilter } from './_components/plan-status-filter'

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

const FALLBACK_TIER_COLOR = '#7e22cf'

const isDone = (d: DeliverableDisplay) => {
  if (d.status === 'done') return true
  if (d.target_count != null && d.target_count > 0) {
    return d.actual_count >= d.target_count
  }
  return false
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
  if (ctx.client.intake_mode === 'intakes_only') redirect('/intakes')

  const supabase = await createClient()

  const subIds = ctx.selectedSubscriptions.map((s) => s.id)

  const deliverablesRes =
    subIds.length > 0
      ? await supabase
          .from('deliverables_display')
          .select('id, title, source, is_incentive, module_code, status, actual_count, target_count, target_unit, frequency, client_visible')
          .in('subscription_id', subIds)
          .eq('client_visible', true)
          .returns<DeliverableDisplay[]>()
      : { data: [] as DeliverableDisplay[] }

  const all = deliverablesRes.data ?? []

  // Aggregate stats — computed off the unfiltered set so the KPI cards
  // and overall completion bar reflect the whole plan, not just the
  // current filter view (filter only narrows the per-module tables).
  const totals = {
    total: all.length,
    done: all.filter(isDone).length,
    in_progress: all.filter((d) => d.status === 'in_progress' && !isDone(d)).length,
    pending: all.filter((d) => d.status === 'pending').length,
  }
  const overallPct = totals.total === 0
    ? 0
    : Math.round((totals.done / totals.total) * 100)

  // Apply the status filter to the per-module rendering only.
  const statusFilter =
    typeof params.status === 'string' ? params.status : 'all'
  const filtered = all.filter((d) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'done') return isDone(d)
    if (statusFilter === 'in_progress') return d.status === 'in_progress' && !isDone(d)
    if (statusFilter === 'pending') return d.status === 'pending'
    return true
  })

  const byModule: Record<string, DeliverableDisplay[]> = {}
  for (const d of filtered) {
    byModule[d.module_code] = byModule[d.module_code] ?? []
    byModule[d.module_code].push(d)
  }

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

  // Hide modules that have no rows under the active filter — keeps the
  // filtered view tight without affecting the unfiltered "all" view.
  const hideEmpty = statusFilter !== 'all'

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-heading">SEO Plan Progress</h1>
        <p className="mt-1 text-sm text-body">
          {ctx.selectedSubscriptions.length} active subscription
          {ctx.selectedSubscriptions.length === 1 ? '' : 's'}
          {ctx.selectedLocation && <> · {ctx.selectedLocation.label}</>}
        </p>
      </header>

      {/* Hero: package badge(s) + firm name, using the existing
       *  brand-color pill pattern (no new tokens). */}
      {ctx.selectedSubscriptions.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {ctx.selectedSubscriptions.map((s) => {
                const tier = s.package?.color_hex ?? FALLBACK_TIER_COLOR
                return (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: `${tier}1A`,
                      color: tier,
                      borderColor: `${tier}40`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tier }}
                    />
                    {s.package?.display_name ?? s.package?.code ?? '—'}
                  </span>
                )
              })}
            </div>
            <span className="text-sm text-body">{ctx.client.firm_name}</span>
          </CardContent>
        </Card>
      )}

      {/* KPI summary — total / complete / in-progress / pending counts
       *  across every module in the selected plan. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Deliverables', value: totals.total, tone: 'brand' as const },
          { label: 'Complete', value: totals.done, tone: 'success' as const },
          { label: 'In Progress', value: totals.in_progress, tone: 'info' as const },
          { label: 'Pending', value: totals.pending, tone: 'neutral' as const },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="flex flex-col items-center justify-center gap-1 p-5">
              <span
                className={
                  k.tone === 'success'
                    ? 'text-3xl font-semibold text-fg-success-strong'
                    : k.tone === 'info'
                    ? 'text-3xl font-semibold text-fg-brand-strong'
                    : k.tone === 'brand'
                    ? 'text-3xl font-semibold text-fg-brand-strong'
                    : 'text-3xl font-semibold text-heading'
                }
              >
                {k.value}
              </span>
              <span className="text-xs uppercase tracking-wide text-body">
                {k.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall completion bar — visual summary of done / total. */}
      <Card>
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-heading">Overall Completion</span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-semibold text-heading">{overallPct}%</span>
              <Badge variant="secondary">
                {totals.done} of {totals.total} items
              </Badge>
            </span>
          </div>
          <ProgressBar value={totals.done} max={totals.total || 1} />
        </CardContent>
      </Card>

      <PlanStatusFilter />

      {orderedModules.length === 0 && customDeliverables.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-body">
            No modules enabled for your current selection. If you expect to see
            something here, contact your account manager.
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
            hideWhenEmpty={hideEmpty}
          />
        )
      })}

      {customDeliverables.length > 0 && (
        <ModuleSection
          title="Bonuses & extras"
          subtitle="Custom deliverables and free incentives outside the package menu"
          config={{}}
          deliverables={customDeliverables}
          hideWhenEmpty={hideEmpty}
        />
      )}
    </div>
  )
}
