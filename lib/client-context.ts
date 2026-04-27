import { createClient } from '@/lib/supabase/server'

export type ClientLocation = {
  id: string
  label: string
  city: string
  state: string
  is_primary: boolean
}

export type SubscriptionModule = {
  module_code: string
  config: Record<string, unknown>
}

export type ClientSubscription = {
  id: string
  status: string
  started_at: string
  location_id: string | null
  package: {
    code: string
    display_name: string
    tier_order: number
    color_hex: string | null
  } | null
  modules: SubscriptionModule[]
}

export type ClientContext = {
  client: {
    id: string
    firm_name: string
    primary_domain: string | null
    is_demo_only: boolean
  }
  locations: ClientLocation[]
  selectedLocation: ClientLocation | null
  subscriptions: ClientSubscription[]
  selectedSubscriptions: ClientSubscription[]
}

type RawSubscription = {
  id: string
  status: string
  started_at: string
  location_id: string | null
  package: {
    code: string
    display_name: string
    tier_order: number
    color_hex: string | null
  } | null
}

type RawModule = {
  module_code: string
  config: Record<string, unknown> | null
  package: { code: string } | null
}

// Resolves the current client + (optional) selected location for the
// logged-in client_user. Single-tenant case: user has access to one client.
// Multi-location: ?location=<uuid> in URL picks which location's
// subscriptions render. With no param, picks the primary location.
//
// Returns null if the user isn't a client_user or has no client memberships.
export async function getClientContext(searchParams?: URLSearchParams): Promise<ClientContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // RLS filters to clients this user has access to via client_users.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, firm_name, primary_domain, is_demo_only')
    .limit(1)

  const client = clients?.[0]
  if (!client) return null

  const [locationsRes, subscriptionsRes] = await Promise.all([
    supabase
      .from('client_locations')
      .select('id, label, city, state, is_primary')
      .eq('client_id', client.id)
      .order('is_primary', { ascending: false })
      .order('label', { ascending: true })
      .returns<ClientLocation[]>(),
    supabase
      .from('subscriptions')
      .select(`
        id, status, started_at, location_id,
        package:package_templates(code, display_name, tier_order, color_hex)
      `)
      .eq('client_id', client.id)
      .returns<RawSubscription[]>(),
  ])

  const rawSubs = subscriptionsRes.data ?? []
  const packageCodes = Array.from(
    new Set(rawSubs.map((s) => s.package?.code).filter((c): c is string => Boolean(c)))
  )

  // Fetch modules for the packages this client subscribes to. Done as a
  // separate query because package_modules is FK'd to package_templates,
  // not subscriptions.
  const { data: rawModules } = await supabase
    .from('package_modules')
    .select('module_code, config, package:package_templates!inner(code)')
    .in('package.code', packageCodes.length > 0 ? packageCodes : ['__none__'])
    .returns<RawModule[]>()

  const modulesByPackageCode: Record<string, SubscriptionModule[]> = {}
  for (const m of rawModules ?? []) {
    const code = m.package?.code
    if (!code) continue
    modulesByPackageCode[code] = modulesByPackageCode[code] ?? []
    modulesByPackageCode[code].push({
      module_code: m.module_code,
      config: m.config ?? {},
    })
  }

  const subscriptions: ClientSubscription[] = rawSubs.map((s) => ({
    ...s,
    modules: s.package?.code ? modulesByPackageCode[s.package.code] ?? [] : [],
  }))

  const locations = locationsRes.data ?? []
  const requestedLocationId = searchParams?.get('location')
  const selectedLocation =
    locations.find((l) => l.id === requestedLocationId) ??
    locations.find((l) => l.is_primary) ??
    locations[0] ??
    null

  // Subscriptions matching the selected location PLUS any with null location_id
  // (Daniels' standalone Live Intakes applies to the whole client, no location).
  const selectedSubscriptions = subscriptions.filter(
    (s) =>
      s.status !== 'cancelled' &&
      (s.location_id === null || s.location_id === selectedLocation?.id)
  )

  return {
    client,
    locations,
    selectedLocation,
    subscriptions,
    selectedSubscriptions,
  }
}
