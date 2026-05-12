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
import {
  GoogleBusinessProfileCard,
  type GbpSnapshot,
  type GbpLatestPost,
} from '@/components/client/cards/google-business-profile'
import { ResourcesCard } from '@/components/client/cards/resources'
import { FeatureVideoCard } from '@/components/client/cards/feature-video'
import { FirmHeaderCard } from '@/components/client/cards/firm-header'
import { WhyThisMattersCard } from '@/components/client/cards/why-this-matters'
import {
  PreLaunchChecklistCard,
  PRE_LAUNCH_STEPS,
  type PreLaunchStepRow,
} from '@/components/client/cards/pre-launch-checklist'
import CustomerPortalRocketFlyover from '@/components/customer-portal/CustomerPortalRocketFlyover'

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
type RawSubmission = {
  id: string
  kind: string
  title: string | null
  link_url: string
  reviewed_at: string | null
  submitted_at: string
}

function submissionKindToRecentKind(kind: string): RecentUpdate['kind'] {
  if (kind === 'blog' || kind === 'faq' || kind === 'ai_page') return 'blog'
  if (kind === 'gmb_post' || kind === 'social_post') return 'social'
  return 'other'
}

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

  const preLaunch = ctx.client.status === 'onboarding' || ctx.client.status === 'prospect'
  const subIds = ctx.selectedSubscriptions.map((s) => s.id)
  const today = new Date().toISOString().slice(0, 10)

  const [
    deliverablesRes,
    ticketsRes,
    siteHealthRes,
    postsRes,
    callsRes,
    credsRes,
    gbpSnapshotRes,
    gbpLatestPostRes,
    submissionsRes,
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
      .select('ga4_property_url, gsc_property_url, google_ads_account_url, google_ads_customer_id, lsa_account_url')
      .eq('client_id', ctx.client.id)
      .maybeSingle(),
    admin
      .from('gmb_snapshots')
      .select('rating, review_count, posts_30d, captured_on')
      .eq('client_id', ctx.client.id)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle<GbpSnapshot>(),
    admin
      .from('posts')
      .select('title, excerpt, published_at, url')
      .eq('client_id', ctx.client.id)
      .eq('source_type', 'gbp_post')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle<GbpLatestPost>(),
    admin
      .from('deliverable_submissions')
      .select('id, kind, title, link_url, reviewed_at, submitted_at')
      .eq('client_id', ctx.client.id)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
      .limit(20)
      .returns<RawSubmission[]>(),
  ])

  const activeSub = ctx.selectedSubscriptions.find((s) => s.status === 'active')
    ?? ctx.selectedSubscriptions[0] ?? null
  const packageHeader: PackageHeader | null = activeSub?.package
    ? {
        display_name: activeSub.package.display_name,
        monthly_fee_cents: null,
        color_hex: activeSub.package.color_hex,
      }
    : null

  const updates: RecentUpdate[] = [
    ...(postsRes.data ?? []).map<RecentUpdate>((p) => ({
      id: `post-${p.id}`,
      kind:
        p.source_type === 'gbp_post'
          ? 'social'
          : p.source_type === 'wp_page'
          ? 'other'
          : 'blog',
      title: p.title ?? 'Untitled post',
      occurred_at: p.published_at ?? new Date().toISOString(),
    })),
    ...(callsRes.data ?? []).map<RecentUpdate>((c) => ({
      id: `call-${c.id}`,
      kind: 'call',
      title: `Call from ${c.caller_name ?? 'unknown caller'}`,
      occurred_at: c.started_at ?? new Date().toISOString(),
    })),
    ...(submissionsRes.data ?? []).map<RecentUpdate>((s) => ({
      id: `submission-${s.id}`,
      kind: submissionKindToRecentKind(s.kind),
      title: s.title ?? s.kind.replace(/_/g, ' '),
      occurred_at: s.reviewed_at ?? s.submitted_at,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 6)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Rocket flyover plays one diagonal arc from bottom-left to
       *  top-right on the user's first overview visit per browser
       *  session, then unmounts itself. Decorative; pointer-events
       *  none. */}
      <CustomerPortalRocketFlyover />
      <div>
        <h1 className="text-3xl text-heading">
          {preLaunch ? 'Building ' : 'Welcome back, '}
          {ctx.client.firm_name}
        </h1>
        <p className="mt-1 text-sm text-body">
          {preLaunch
            ? "You're in pre-launch — here's where every piece of your foundation stands."
            : "Here's where your active work stands this period"}
          {ctx.selectedLocation && <> for {ctx.selectedLocation.label}</>}.
        </p>
      </div>

      {preLaunch ? (
        <PreLaunchLayout
          firmName={ctx.client.firm_name}
          packageHeader={packageHeader}
          adDate={ctx.client.ad_date}
          agreedLaunchDate={ctx.client.agreed_launch_date}
          tickets={ticketsRes.data ?? []}
          updates={updates}
          submissions={submissionsRes.data ?? []}
        />
      ) : (
        <PostLaunchLayout
          firmName={ctx.client.firm_name}
          packageHeader={packageHeader}
          launchDate={ctx.client.onboarded_at}
          nextBillingAt={ctx.client.next_billing_at}
          deliverables={(deliverablesRes.data ?? []).map(toProgress)}
          tickets={ticketsRes.data ?? []}
          updates={updates}
          creds={credsRes.data ?? null}
          siteHealth={siteHealthRes.data ?? null}
          gbpSnapshot={gbpSnapshotRes.data ?? null}
          gbpLatestPost={gbpLatestPostRes.data ?? null}
        />
      )}
    </div>
  )
}

function toProgress(d: RawDeliverable): DeliverableProgress {
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    target_count: d.target_count,
    actual_count:
      d.actual_count != null
        ? d.actual_count
        : d.status === 'done'
        ? d.target_count
        : d.status === 'in_progress'
        ? Math.floor((d.target_count ?? 0) / 2)
        : 0,
  }
}

function PreLaunchLayout({
  firmName,
  packageHeader,
  adDate,
  agreedLaunchDate,
  tickets,
  updates,
  submissions,
}: {
  firmName: string
  packageHeader: PackageHeader | null
  adDate: string | null
  agreedLaunchDate: string | null
  tickets: TicketSummary[]
  updates: RecentUpdate[]
  submissions: RawSubmission[]
}) {
  // Collapse submissions into a per-kind summary so the checklist can
  // show "done" once any approved submission of that kind exists.
  const rows: PreLaunchStepRow[] = PRE_LAUNCH_STEPS.map((step) => {
    const matches = submissions.filter((s) => s.kind === step.kind)
    const latest = matches[0] ?? null
    return {
      kind: step.kind,
      done_count: matches.length,
      latest_link_url: latest?.link_url ?? null,
      latest_at: latest?.reviewed_at ?? latest?.submitted_at ?? null,
    }
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* LEFT — firm card + recent updates */}
      <div className="space-y-6 lg:col-span-3">
        <FirmHeaderCard
          firmName={firmName}
          packageName={packageHeader?.display_name ?? null}
          packageColorHex={packageHeader?.color_hex ?? null}
          preLaunch
          adDate={adDate}
          agreedLaunchDate={agreedLaunchDate}
          launchDate={null}
          nextBillingAt={null}
        />
        <RecentUpdatesCard updates={updates} />
      </div>

      {/* CENTER — why-this-matters + the build checklist */}
      <div className="space-y-6 lg:col-span-6">
        <WhyThisMattersCard preLaunch />
        <PreLaunchChecklistCard rows={rows} />
      </div>

      {/* RIGHT — tickets + resources */}
      <div className="space-y-6 lg:col-span-3">
        <SupportTicketsCard tickets={tickets} />
        <ResourcesCard />
      </div>
    </div>
  )
}

function PostLaunchLayout({
  firmName,
  packageHeader,
  launchDate,
  nextBillingAt,
  deliverables,
  tickets,
  updates,
  creds,
  siteHealth,
  gbpSnapshot,
  gbpLatestPost,
}: {
  firmName: string
  packageHeader: PackageHeader | null
  launchDate: string | null
  nextBillingAt: string | null
  deliverables: DeliverableProgress[]
  tickets: TicketSummary[]
  updates: RecentUpdate[]
  creds: {
    ga4_property_url: string | null
    gsc_property_url: string | null
    google_ads_account_url: string | null
    google_ads_customer_id: string | null
    lsa_account_url: string | null
  } | null
  siteHealth: RawSiteHealth | null
  gbpSnapshot: GbpSnapshot | null
  gbpLatestPost: GbpLatestPost | null
}) {
  const integrationLinks: IntegrationLink[] = []
  if (creds?.ga4_property_url) integrationLinks.push({ key: 'ga4', href: creds.ga4_property_url, external: true })
  if (creds?.gsc_property_url) integrationLinks.push({ key: 'gsc', href: creds.gsc_property_url, external: true })
  const googleAdsHref = creds?.google_ads_customer_id
    ? `https://ads.google.com/aw/overview?__c=${creds.google_ads_customer_id}`
    : creds?.google_ads_account_url ?? null
  if (googleAdsHref) integrationLinks.push({ key: 'google_ads', href: googleAdsHref, external: true })
  if (creds?.lsa_account_url) integrationLinks.push({ key: 'lsa', href: creds.lsa_account_url, external: true })
  integrationLinks.push({ key: 'keyword_tool', href: '/plan', external: false })

  const team: TeamMember[] = []

  const lighthouseScores: LighthouseScores | null = siteHealth
    ? {
        performance: siteHealth.performance,
        accessibility: siteHealth.accessibility,
        best_practices: siteHealth.best_practices,
        seo: siteHealth.seo,
        captured_on: siteHealth.captured_on,
      }
    : null

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* LEFT — firm header + plan */}
      <div className="space-y-6 lg:col-span-3">
        <FirmHeaderCard
          firmName={firmName}
          packageName={packageHeader?.display_name ?? null}
          packageColorHex={packageHeader?.color_hex ?? null}
          preLaunch={false}
          adDate={null}
          agreedLaunchDate={null}
          launchDate={launchDate}
          nextBillingAt={nextBillingAt}
        />
        <SeoPlanProgressCard packageHeader={packageHeader} deliverables={deliverables} />
      </div>

      {/* CENTER — why-this-matters + tickets + recent updates + walkthrough video */}
      <div className="space-y-6 lg:col-span-5">
        <WhyThisMattersCard preLaunch={false} />
        <SupportTicketsCard tickets={tickets} />
        <RecentUpdatesCard updates={updates} />
        <SupportTeamCard members={team} />
        <FeatureVideoCard />
      </div>

      {/* RIGHT — site health + GBP + integrations + resources */}
      <div className="space-y-6 lg:col-span-4">
        <LighthouseScoresCard scores={lighthouseScores} />
        <GoogleBusinessProfileCard
          snapshot={gbpSnapshot}
          latestPost={gbpLatestPost}
        />
        <IntegrationsCard links={integrationLinks} />
        <ResourcesCard />
      </div>
    </div>
  )
}
