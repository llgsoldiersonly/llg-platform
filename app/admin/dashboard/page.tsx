import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, Briefcase, MapPin, ClipboardList, Gift, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

type StatCard = {
  label: string
  value: number
  Icon: LucideIcon
  /** Color band on the chip + value emphasis. */
  variant: 'brand' | 'success' | 'info' | 'warning'
}

const VARIANTS: Record<StatCard['variant'], { chip: string; value: string }> = {
  brand:   { chip: 'bg-brand-soft text-fg-brand-strong',         value: 'text-fg-brand-strong' },
  success: { chip: 'bg-success-soft text-fg-success-strong',     value: 'text-fg-success-strong' },
  info:    { chip: 'bg-blue-100 text-blue-800',                  value: 'text-blue-800' },
  warning: { chip: 'bg-warning-soft text-fg-warning',            value: 'text-fg-warning' },
}

export default async function AdminDashboardPage() {
  const supa = createAdminClient()

  const [
    activeClients,
    onboardingClients,
    demoClients,
    subscriptions,
    locations,
    deliverables,
    incentives,
  ] = await Promise.all([
    supa.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supa.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'onboarding'),
    supa.from('clients').select('*', { count: 'exact', head: true }).eq('is_demo_only', true),
    supa.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supa.from('client_locations').select('*', { count: 'exact', head: true }),
    supa.from('deliverables').select('*', { count: 'exact', head: true }),
    supa.from('deliverables').select('*', { count: 'exact', head: true }).eq('is_incentive', true),
  ])

  const cards: StatCard[] = [
    { label: 'Active clients',       value: activeClients.count ?? 0,       Icon: Users,         variant: 'brand' },
    { label: 'Onboarding',           value: onboardingClients.count ?? 0,   Icon: UserPlus,      variant: 'warning' },
    { label: 'Active subscriptions', value: subscriptions.count ?? 0,       Icon: Briefcase,     variant: 'info' },
    { label: 'Tracked locations',    value: locations.count ?? 0,           Icon: MapPin,        variant: 'brand' },
    { label: 'Open deliverables',    value: deliverables.count ?? 0,        Icon: ClipboardList, variant: 'warning' },
    { label: 'Active incentives',    value: incentives.count ?? 0,          Icon: Gift,          variant: 'success' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Dashboard</h1>
          <p className="mt-1 text-sm text-body">
            Real-time counts across all clients
          </p>
        </div>
        {(demoClients.count ?? 0) > 0 && (
          <Badge variant="warning">{demoClients.count} demo client</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const styles = VARIANTS[card.variant]
          return (
            <Card key={card.label} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-card',
                    styles.chip
                  )}
                >
                  <card.Icon className="h-6 w-6" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-medium uppercase tracking-wider text-body-subtle">
                    {card.label}
                  </p>
                  <p className={cn('mt-1 text-3xl font-semibold tabular-nums', styles.value)}>
                    {card.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
