import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { SeoPlanProgressCard, type DeliverableProgress, type PackageHeader } from '@/components/client/cards/seo-plan-progress'
import { SupportTicketsCard, type TicketSummary } from '@/components/client/cards/support-tickets'
import { SupportTeamCard, type TeamMember } from '@/components/client/cards/support-team'
import { LighthouseScoresCard, type LighthouseScores } from '@/components/client/cards/lighthouse-scores'
import { RecentUpdatesCard, type RecentUpdate } from '@/components/client/cards/recent-updates'
import { IntegrationsCard, type IntegrationLink } from '@/components/client/cards/integrations'
import { ResourcesCard } from '@/components/client/cards/resources'
import { FeatureVideoCard } from '@/components/client/cards/feature-video'

export const dynamic = 'force-dynamic'

type RawDeliverable = {
  id: string
  title: string
  status: 'done' | 'in_progress' | 'pending' | 'blocked'
  target_count: number | null
  actual_count: number | null
  client_visible: boolean
}

type RawSiteHealth = {
  performance: number | null
  seo: number | null
  accessibility: number | null
  best_practices: number | null
  captured_on: string
}

type RawPost = { id: string; title: string | null; published_at: string | null; source_type: string }
type RawCall = { id: string; caller_name: string | null; started_at: string | null }

export default async function OverviewPage({
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
  const admin = createAdminClient()

  const subIds = ctx.selectedSubscriptions.map((s) => s.id)
  const today = new Date().toISOString().slice(0, 10)

  const [
    deliverablesRes,
    ticketsRes,
    siteHealthRes,
    postsRes,
    callsRes,
    credsRes,
  ] = await Promise.all([
    subIds.length > 0
      ? supabase
          .from('deliverables_display')
          .select('id, title, status, target_count, actual_count, client_visible')
          .in('subscription_id', subIds)
          .lte('period_start', today)
          .gte('period_end', today)
          .eq('client_visible', true)
          .returns<RawDeliverable[]>()
      : Promise.resolve({ data: [] }),
    supabase
      .from('tickets')
      .select('id, ticket_number, subject, status, created_at')
      .eq('client_id', ctx.client.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<TicketSummary[]>(),
    admin
      .from('site_health')
      .select('performance, seo, accessibility, best_practices, captured_on')
      .eq('client_id', ctx.client.id)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle<RawSiteHealth>(),
    admin
      .from('posts')
      .select('id, title, published_at, source_type')
      .eq('client_id', ctx.client.id)
      .order('published_at', { ascending: false })
      .limit(4)
      .returns<RawPost[]>(),
    admin
      .from('calls')
      .select('id, caller_name, started_at')
      .eq('client_id', ctx.client.id)
      .order('started_at', { ascending: false })
      .limit(2)
      .returns<RawCall[]>(),
    admin
      .from('client_credentials')
      .select('ga4_property_url, gsc_property_url, google_ads_account_url, lsa_account_url')
      .eq('client_id', ctx.client.id)
      .maybeSingle(),
  ])

  // Pick the first active subscription for the package header (most clients
  // are single-package; multi-package clients can switch via location).
  const activeSub = ctx.selectedSubscriptions.find((s) => s.status === 'active')
    ?? ctx.selectedSubscriptions[0] ?? null
  const packageHeader: PackageHeader | null = activeSub?.package
    ? {
        display_name: activeSub.package.display_name,
        // monthly_fee_cents lives on package_templates; not in the trimmed
        // ClientSubscription type. Surfaced as null until we widen that type.
        monthly_fee_cents: null,
        color_hex: activeSub.package.color_hex,
      }
    : null

  const deliverables: DeliverableProgress[] = (deliverablesRes.data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    target_count: d.target_count,
    actual_count:
      d.actual_count != null
        ? d.actual_count
        // Approximate from status when actual_count isn't tracked yet so the
        // bar isn't flat for in-progress items.
        : d.status === 'done'
        ? d.target_count
        : d.status === 'in_progress'
        ? Math.floor((d.target_count ?? 0) / 2)
        : 0,
  }))

  const updates: RecentUpdate[] = [
    ...(postsRes.data ?? []).map<RecentUpdate>((p) => ({
      id: `post-${p.id}`,
      kind: p.source_type === 'wp_page' ? 'other' : 'blog',
      title: p.title ?? 'Untitled post',
      occurred_at: p.published_at ?? new Date().toISOString(),
    })),
    ...(callsRes.data ?? []).map<RecentUpdate>((c) => ({
      id: `call-${c.id}`,
      kind: 'call',
      title: `Call from ${c.caller_name ?? 'unknown caller'}`,
      occurred_at: c.started_at ?? new Date().toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 6)

  const creds = credsRes.data ?? null
  const integrationLinks: IntegrationLink[] = []
  if (creds?.ga4_property_url) integrationLinks.push({ key: 'ga4', href: creds.ga4_property_url, external: true })
  if (creds?.gsc_property_url) integrationLinks.push({ key: 'gsc', href: creds.gsc_property_url, external: true })
  if (creds?.google_ads_account_url) integrationLinks.push({ key: 'google_ads', href: creds.google_ads_account_url, external: true })
  if (creds?.lsa_account_url) integrationLinks.push({ key: 'lsa', href: creds.lsa_account_url, external: true })
  // Always-on internal link to the SEO Plan keyword tracking section.
  integrationLinks.push({ key: 'keyword_tool', href: '/plan', external: false })

  // Support team is empty until we model per-client team assignments
  // (planned for v1.5 — see project memory). Empty state renders cleanly.
  const team: TeamMember[] = []


  const lighthouseScores: LighthouseScores | null = siteHealthRes.data
    ? {
        performance: siteHealthRes.data.performance,
        accessibility: siteHealthRes.data.accessibility,
        best_practices: siteHealthRes.data.best_practices,
        seo: siteHealthRes.data.seo,
        captured_on: siteHealthRes.data.captured_on,
      }
    : null

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl text-heading">
          Welcome back, {ctx.client.firm_name}
        </h1>
        <p className="mt-1 text-sm text-body">
          Here&apos;s where your active work stands this period
          {ctx.selectedLocation && <> for {ctx.selectedLocation.label}</>}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT — plan + integrations + recent updates at the bottom */}
        <div className="space-y-6 lg:col-span-3">
          <SeoPlanProgressCard packageHeader={packageHeader} deliverables={deliverables} />
          <IntegrationsCard links={integrationLinks} />
          <RecentUpdatesCard updates={updates} />
        </div>

        {/* CENTER — tickets + team + walkthrough video */}
        <div className="space-y-6 lg:col-span-5">
          <SupportTicketsCard tickets={ticketsRes.data ?? []} />
          <SupportTeamCard members={team} />
          <FeatureVideoCard />
        </div>

        {/* RIGHT — lighthouse + resource hub at the bottom */}
        <div className="space-y-6 lg:col-span-4">
          <LighthouseScoresCard scores={lighthouseScores} />
          <ResourcesCard />
        </div>
      </div>
    </div>
  )
}
