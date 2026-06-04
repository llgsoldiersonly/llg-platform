import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { SupportTicketsCard, type TicketSummary } from '@/components/client/cards/support-tickets'
import { SupportTeamCard, type TeamMember } from '@/components/client/cards/support-team'
import { LighthouseScoresCard, type LighthouseScores } from '@/components/client/cards/lighthouse-scores'
import { CallsCard, type CallRow } from '@/components/client/cards/calls'
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
import { MonthlyProductionCard } from '@/components/client/cards/monthly-production'
import { LlgUpdatesCard } from '@/components/client/cards/llg-updates'
import { aggregateProduction, applyPackageVisibility, type RawProductionRow } from '@/lib/post-launch-production'
import { blendSiteHealth } from '@/lib/integrations/score-blend'
import { fetchLlgBlogPosts, type LlgBlogPost } from '@/lib/llg-blog-feed'
import CustomerPortalRocketFlyover from '@/components/customer-portal/CustomerPortalRocketFlyover'

export const dynamic = 'force-dynamic'

type RawSiteHealth = {
  strategy: 'mobile' | 'desktop'
  performance: number | null
  seo: number | null
  accessibility: number | null
  best_practices: number | null
  lcp_ms: number | null
  fid_ms: number | null
  cls: number | null
  crux_lcp_ms: number | null
  crux_inp_ms: number | null
  crux_cls: number | null
  crux_fcp_ms: number | null
  crux_category: string | null
  captured_on: string
}

type RawPost = { id: string; title: string | null; published_at: string | null; source_type: string }
type RawCall = {
  id: string
  caller_name: string | null
  caller_number: string | null
  tags: string[] | null
  started_at: string | null
  ai_summary: string | null
  lead_score: number | null
}
type RawSubmission = {
  id: string
  kind: string
  title: string | null
  link_url: string
  reviewed_at: string | null
  submitted_at: string
}

// Shape returned by the deliverables→package_deliverables join used to drive
// the post-launch production card. We only consider package-backed rows
// (template_id is not null) because the 6 buckets all key off code patterns.
type RawProductionJoinedRow = {
  actual_count: number | null
  template: { code: string; target_count: number | null } | null
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
    productionRes,
    ticketsRes,
    siteHealthRes,
    postsRes,
    callsRes,
    credsRes,
    gbpSnapshotRes,
    gbpLatestPostRes,
    submissionsRes,
    llgPosts,
  ] = await Promise.all([
    subIds.length > 0
      ? admin
          .from('deliverables')
          .select('actual_count, template:package_deliverables!inner(code, target_count)')
          .in('subscription_id', subIds)
          .lte('period_start', today)
          .gte('period_end', today)
          .returns<RawProductionJoinedRow[]>()
      : Promise.resolve({ data: [] as RawProductionJoinedRow[] }),
    supabase
      .from('tickets')
      .select('id, ticket_number, subject, status, created_at')
      .eq('client_id', ctx.client.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<TicketSummary[]>(),
    admin
      .from('site_health')
      .select(`
        strategy, performance, seo, accessibility, best_practices,
        lcp_ms, fid_ms, cls,
        crux_lcp_ms, crux_inp_ms, crux_cls, crux_fcp_ms, crux_category,
        captured_on
      `)
      .eq('client_id', ctx.client.id)
      .eq('site_id', ctx.selectedSite?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('captured_on', { ascending: false })
      .limit(8)
      .returns<RawSiteHealth[]>(),
    admin
      .from('posts')
      .select('id, title, published_at, source_type')
      .eq('client_id', ctx.client.id)
      .order('published_at', { ascending: false })
      .limit(4)
      .returns<RawPost[]>(),
    admin
      .from('calls')
      .select('id, caller_name, caller_number, tags, started_at, ai_summary, lead_score')
      .eq('client_id', ctx.client.id)
      .order('started_at', { ascending: false })
      .limit(60)
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
    // GBP posts come from staff submissions (kind='gmb_post', approved) —
    // not from `posts` table. DFS's my_business_updates is on a gated tier
    // and the official GBP API needs per-firm OAuth we don't have. Source
    // of truth is the agency staff who actually publish the posts.
    admin
      .from('deliverable_submissions')
      .select('title, link_url, reviewed_at, submitted_at, notes')
      .eq('client_id', ctx.client.id)
      .eq('kind', 'gmb_post')
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
      .limit(20),
    admin
      .from('deliverable_submissions')
      .select('id, kind, title, link_url, reviewed_at, submitted_at')
      .eq('client_id', ctx.client.id)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
      .limit(20)
      .returns<RawSubmission[]>(),
    // Hourly-revalidated fetch — wraps its own try/catch so a fetch failure
    // never breaks the page.
    fetchLlgBlogPosts(),
  ])

  const activeSub =
    ctx.selectedSubscriptions.find((s) => s.status === 'active') ??
    ctx.selectedSubscriptions[0] ??
    null

  // CrUX/lab blend weight — single config value, read once per render.
  const { data: settingsRow } = await admin
    .from('platform_settings')
    .select('crux_weight')
    .eq('id', 1)
    .maybeSingle<{ crux_weight: number | null }>()
  const cruxWeight = settingsRow?.crux_weight ?? 0.66

  const productionRows: RawProductionRow[] = (productionRes.data ?? []).map((r) => ({
    code: r.template?.code ?? null,
    target_count: r.template?.target_count ?? null,
    actual_count: r.actual_count,
  }))
  const productionCategories = applyPackageVisibility(
    aggregateProduction(productionRows),
    activeSub?.package?.code ?? null
  )

  // GBP posts — sourced from staff submissions (kind='gmb_post', approved)
  // rather than DataForSEO (gated tier) or an OAuth-based GBP API.
  // gbpLatestPostRes holds the 20 most-recent approved submissions; shape
  // them into the widget's expected types.
  const gbpSubmissions = (gbpLatestPostRes.data ?? []) as Array<{
    title: string | null
    link_url: string
    reviewed_at: string | null
    submitted_at: string
    notes: string | null
  }>
  const latestGbpSubmission = gbpSubmissions[0] ?? null
  const latestGbpPost: GbpLatestPost | null = latestGbpSubmission
    ? {
        title: latestGbpSubmission.title,
        excerpt: latestGbpSubmission.notes ?? latestGbpSubmission.title,
        published_at: latestGbpSubmission.reviewed_at ?? latestGbpSubmission.submitted_at,
        url: latestGbpSubmission.link_url,
      }
    : null

  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000
  const gbpPostsLast30d = gbpSubmissions.filter((s) => {
    const ts = s.reviewed_at ?? s.submitted_at
    return ts ? new Date(ts).getTime() >= thirtyDaysAgoMs : false
  }).length

  // Splice the staff-derived count into the GBP snapshot so the widget's
  // "N posts in last 30 days" line reflects reality. Rating + review count
  // still come from gmb_snapshots (DFS my_business_info, which works).
  const gbpSnapshotShaped: GbpSnapshot | null = gbpSnapshotRes.data
    ? {
        rating: gbpSnapshotRes.data.rating,
        review_count: gbpSnapshotRes.data.review_count,
        posts_30d: gbpPostsLast30d,
        captured_on: gbpSnapshotRes.data.captured_on,
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

  // Period label for the production card — "May 2026" style.
  const periodLabel = format(new Date(), 'MMMM yyyy')

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
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
          packageName={activeSub?.package?.display_name ?? null}
          packageColorHex={activeSub?.package?.color_hex ?? null}
          adDate={ctx.client.ad_date}
          agreedLaunchDate={ctx.client.agreed_launch_date}
          tickets={ticketsRes.data ?? []}
          updates={updates}
          submissions={submissionsRes.data ?? []}
        />
      ) : (
        <PostLaunchLayout
          firmName={ctx.client.firm_name}
          packageName={activeSub?.package?.display_name ?? null}
          packageColorHex={activeSub?.package?.color_hex ?? null}
          launchDate={ctx.client.onboarded_at}
          nextBillingAt={ctx.client.next_billing_at}
          productionCategories={productionCategories}
          periodLabel={periodLabel}
          tickets={ticketsRes.data ?? []}
          updates={updates}
          creds={credsRes.data ?? null}
          siteHealth={siteHealthRes.data ?? []}
          cruxWeight={cruxWeight}
          showSiteHealth={ctx.client.show_site_health}
          calls={callsRes.data ?? []}
          gbpSnapshot={gbpSnapshotShaped}
          gbpLatestPost={latestGbpPost}
          llgPosts={llgPosts}
        />
      )}
    </div>
  )
}

function PreLaunchLayout({
  firmName,
  packageName,
  packageColorHex,
  adDate,
  agreedLaunchDate,
  tickets,
  updates,
  submissions,
}: {
  firmName: string
  packageName: string | null
  packageColorHex: string | null
  adDate: string | null
  agreedLaunchDate: string | null
  tickets: TicketSummary[]
  updates: RecentUpdate[]
  submissions: RawSubmission[]
}) {
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
          packageName={packageName}
          packageColorHex={packageColorHex}
          preLaunch
          adDate={adDate}
          agreedLaunchDate={agreedLaunchDate}
          launchDate={null}
          nextBillingAt={null}
        />
        <RecentUpdatesCard updates={updates} />
        <SupportTicketsCard tickets={tickets} />
      </div>

      {/* CENTER — why-this-matters + the build checklist */}
      <div className="space-y-6 lg:col-span-6">
        <WhyThisMattersCard preLaunch />
        <PreLaunchChecklistCard rows={rows} />
      </div>

      {/* RIGHT — resources */}
      <div className="space-y-6 lg:col-span-3">
        <ResourcesCard />
      </div>
    </div>
  )
}

function PostLaunchLayout({
  firmName,
  packageName,
  packageColorHex,
  launchDate,
  nextBillingAt,
  productionCategories,
  periodLabel,
  tickets,
  updates,
  creds,
  siteHealth,
  cruxWeight,
  showSiteHealth,
  calls,
  gbpSnapshot,
  gbpLatestPost,
  llgPosts,
}: {
  firmName: string
  packageName: string | null
  packageColorHex: string | null
  launchDate: string | null
  nextBillingAt: string | null
  productionCategories: ReturnType<typeof aggregateProduction>
  periodLabel: string
  tickets: TicketSummary[]
  updates: RecentUpdate[]
  creds: {
    ga4_property_url: string | null
    gsc_property_url: string | null
    google_ads_account_url: string | null
    google_ads_customer_id: string | null
    lsa_account_url: string | null
  } | null
  siteHealth: RawSiteHealth[]
  cruxWeight: number
  showSiteHealth: boolean
  calls: CallRow[]
  gbpSnapshot: GbpSnapshot | null
  gbpLatestPost: GbpLatestPost | null
  llgPosts: LlgBlogPost[]
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

  // Prefer mobile (closer to what most law-firm visitors actually use); fall
  // back to desktop, then to whatever's most recent. Card displays one row.
  const preferredHealth: RawSiteHealth | null = (() => {
    const mobile = siteHealth.find((r) => r.strategy === 'mobile')
    if (mobile) return mobile
    const desktop = siteHealth.find((r) => r.strategy === 'desktop')
    if (desktop) return desktop
    return siteHealth[0] ?? null
  })()

  // Blend the Lighthouse lab score with a CrUX-derived "field score" computed
  // from real-user p75 metrics. When CrUX isn't available (low-traffic sites)
  // the displayed score falls back to lab-only.
  const blended = preferredHealth
    ? blendSiteHealth(
        preferredHealth.strategy,
        {
          performance: preferredHealth.performance,
          lcp_ms: preferredHealth.lcp_ms,
          fid_ms: preferredHealth.fid_ms,
          cls: preferredHealth.cls,
        },
        {
          lcp_ms: preferredHealth.crux_lcp_ms,
          inp_ms: preferredHealth.crux_inp_ms,
          cls: preferredHealth.crux_cls,
          fcp_ms: preferredHealth.crux_fcp_ms,
        },
        cruxWeight
      )
    : null

  const lighthouseScores: LighthouseScores | null = preferredHealth
    ? {
        performance: blended?.displayed_score ?? preferredHealth.performance,
        accessibility: preferredHealth.accessibility,
        best_practices: preferredHealth.best_practices,
        seo: preferredHealth.seo,
        captured_on: preferredHealth.captured_on,
        source: blended?.source,
        crux_score: blended?.crux_score ?? null,
        lab_score: blended?.lab_score ?? null,
      }
    : null

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* LEFT — firm header + recent updates + support team */}
      <div className="space-y-6 lg:col-span-3">
        <FirmHeaderCard
          firmName={firmName}
          packageName={packageName}
          packageColorHex={packageColorHex}
          preLaunch={false}
          adDate={null}
          agreedLaunchDate={null}
          launchDate={launchDate}
          nextBillingAt={nextBillingAt}
        />
        <RecentUpdatesCard updates={updates} />
        <SupportTeamCard members={team} />
        <SupportTicketsCard tickets={tickets} />
      </div>

      {/* CENTER — why-this-matters + condensed monthly production + calls + walkthrough */}
      <div className="space-y-6 lg:col-span-5">
        <WhyThisMattersCard preLaunch={false} />
        <MonthlyProductionCard
          categories={productionCategories}
          periodLabel={periodLabel}
        />
        <CallsCard calls={calls} />
        <FeatureVideoCard />
      </div>

      {/* RIGHT — site health + GBP + integrations + LLG updates + resources */}
      <div className="space-y-6 lg:col-span-4">
        {showSiteHealth && <LighthouseScoresCard scores={lighthouseScores} />}
        <GoogleBusinessProfileCard
          snapshot={gbpSnapshot}
          latestPost={gbpLatestPost}
        />
        <IntegrationsCard links={integrationLinks} />
        <LlgUpdatesCard posts={llgPosts} />
        <ResourcesCard />
      </div>
    </div>
  )
}
