import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RingChart } from '@/components/ui/ring-chart'
import { EmptyState } from '@/components/ui/empty-state'
import {
  calculateVisibilityScore,
  organicScoreFromRanks,
  mapsScoreFromGrid,
  aiScoreFromSnapshots,
  reviewScoreFromRating,
  competitorGapScoreFromBeats,
  scoreLabel,
} from '@/lib/seo/scoring'

export const dynamic = 'force-dynamic'

export default async function SeoOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') sp.set(k, v)

  const ctx = await getClientContext(sp)
  if (!ctx) redirect('/login')

  const admin = createAdminClient()
  const monthKey = new Date().toISOString().slice(0, 7)
  // Backlinks + organic ranks are per-site; scope to the selected website.
  // (Map grid, AI visibility, and GMB remain client/location-scoped.)
  const siteId = ctx.selectedSite?.id ?? '00000000-0000-0000-0000-000000000000'

  const [
    { data: latestBacklinks },
    { data: latestRanks },
    { data: latestGrid },
    { data: aiSnapshots },
    { data: gmb },
  ] = await Promise.all([
    admin
      .from('dfs_backlink_snapshots')
      .select('total_backlinks, referring_domains, new_backlinks, lost_backlinks, new_referring_domains, lost_referring_domains, backlink_spam_score, snapshot_date')
      .eq('client_id', ctx.client.id)
      .eq('site_id', siteId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('dfs_keyword_rank_snapshots')
      .select('rank_absolute, search_type')
      .eq('client_id', ctx.client.id)
      .eq('site_id', siteId)
      .eq('month_key', monthKey)
      .eq('search_type', 'organic'),
    admin
      .from('dfs_map_grid_rank_snapshots')
      .select('client_map_rank, client_found')
      .eq('client_id', ctx.client.id)
      .eq('month_key', monthKey),
    admin
      .from('dfs_ai_visibility_snapshots')
      .select('client_cited')
      .eq('client_id', ctx.client.id)
      .eq('month_key', monthKey),
    admin
      .from('gmb_snapshots')
      .select('rating, review_count')
      .eq('client_id', ctx.client.id)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const organicScore = organicScoreFromRanks(latestRanks ?? [])
  const mapsScore = mapsScoreFromGrid(latestGrid ?? [])
  const aiVisibilityScore = aiScoreFromSnapshots(aiSnapshots ?? [])
  const reviewScore = reviewScoreFromRating(gmb?.rating ?? null)
  const competitorGapScore = competitorGapScoreFromBeats(latestRanks?.length ?? 0, 0) // refined in Phase C+

  const overall = calculateVisibilityScore({
    mapsScore,
    organicScore,
    aiVisibilityScore,
    reviewScore,
    competitorGapScore,
  })

  const hasAnyData =
    latestBacklinks || (latestRanks?.length ?? 0) > 0 || (latestGrid?.length ?? 0) > 0 || (aiSnapshots?.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      {!hasAnyData && (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title="Data is on the way"
              description="The first weekly DataForSEO sweep runs every Monday morning. As soon as it lands you'll see backlink growth, keyword ranks, and map visibility right here."
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Overall visibility score */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Search Visibility Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <RingChart value={overall} size="md" />
            <div className="text-center">
              <div className="text-3xl font-semibold tabular-nums text-heading">
                {overall === null ? '—' : overall}
              </div>
              <div className="text-xs uppercase tracking-wide text-body">{scoreLabel(overall)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Sub-scores */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Where the score comes from</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SubScoreRow label="Maps / Local Pack" weight={40} score={mapsScore} />
              <SubScoreRow label="Organic rankings" weight={25} score={organicScore} />
              <SubScoreRow label="AI visibility" weight={15} score={aiVisibilityScore} />
              <SubScoreRow label="Reviews" weight={10} score={reviewScore} />
              <SubScoreRow label="Competitor gap" weight={10} score={competitorGapScore} />
            </ul>
            <p className="mt-3 text-xs text-body">
              Sub-scores with no data yet are excluded — your overall score is a fair average of what we can measure today.
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-body-subtle">
        Drill into each area using the tabs above — Backlinks, Rankings, AI Visibility, Competitors, and your Monthly Report.
      </p>
    </div>
  )
}

function SubScoreRow({ label, weight, score }: { label: string; weight: number; score: number | null }) {
  return (
    <li className="flex items-center justify-between rounded border border-border-default bg-bg-base px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-heading">{label}</div>
        <div className="text-xs text-body">weight {weight}%</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums text-heading">
          {score === null ? '—' : score}
        </span>
        <Badge variant="secondary">{scoreLabel(score)}</Badge>
      </div>
    </li>
  )
}

