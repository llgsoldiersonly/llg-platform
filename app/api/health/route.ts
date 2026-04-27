import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — no auth required. Used by smoke tests + ops monitoring to
// verify the schema is intact and seed counts are correct. Uses service-role
// internally because anon can't see tenant tables (by design — RLS blocks them).
//
// Returns JSON of expected counts. NEVER returns row data — counts only.
export async function GET() {
  try {
    const supa = createAdminClient()

    const [
      clients,
      demoClients,
      departments,
      packages,
      packageDeliverables,
      subscriptions,
      locations,
      routingRules,
      incentives,
      featureFlags,
    ] = await Promise.all([
      supa.from('clients').select('*', { count: 'exact', head: true }),
      supa.from('clients').select('*', { count: 'exact', head: true }).eq('is_demo_only', true),
      supa.from('departments').select('*', { count: 'exact', head: true }),
      supa.from('package_templates').select('*', { count: 'exact', head: true }),
      supa.from('package_deliverables').select('*', { count: 'exact', head: true }),
      supa.from('subscriptions').select('*', { count: 'exact', head: true }),
      supa.from('client_locations').select('*', { count: 'exact', head: true }),
      supa.from('ticket_routing_rules').select('*', { count: 'exact', head: true }),
      supa.from('deliverables').select('*', { count: 'exact', head: true }).eq('is_incentive', true),
      supa.from('feature_flags').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      ok: true,
      schema_version: 'phase-2',
      counts: {
        clients: clients.count,
        demo_clients: demoClients.count,
        departments: departments.count,
        packages: packages.count,
        package_deliverables: packageDeliverables.count,
        subscriptions: subscriptions.count,
        locations: locations.count,
        routing_rules: routingRules.count,
        incentive_deliverables: incentives.count,
        feature_flags: featureFlags.count,
      },
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      },
      { status: 500 }
    )
  }
}
