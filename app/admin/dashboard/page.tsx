import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

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

  const cards = [
    { label: 'Active clients', value: activeClients.count ?? 0 },
    { label: 'Onboarding', value: onboardingClients.count ?? 0 },
    { label: 'Active subscriptions', value: subscriptions.count ?? 0 },
    { label: 'Tracked locations', value: locations.count ?? 0 },
    { label: 'Open deliverables', value: deliverables.count ?? 0 },
    { label: 'Active incentives', value: incentives.count ?? 0 },
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
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-body">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-heading">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  )
}
