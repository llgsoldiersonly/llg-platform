import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RingChart } from '@/components/ui/ring-chart'
import { NumberTicker } from '@/components/ui/number-ticker'
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
import {
  backlinkInsightCopy,
  rankingInsightCopy,
  aiVisibilityInsightCopy,
  mapsInsightCopy,
} from '@/lib/seo/insights'

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
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('dfs_keyword_rank_snapshots')
      .select('rank_absolute, search_type')
      .eq('client_id', ctx.client.id)
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

  const top3 = (latestRanks ?? []).filter((r) => (r.rank_absolute ?? 99) <= 3).length
  const top10 = (latestRanks ?? []).filter((r) => (r.rank_absolute ?? 99) <= 10).length
  const gridTop3 = (latestGrid ?? []).filter((p) => p.client_found && (p.client_map_rank ?? 99) <= 3).length
  const gridNotFound = (latestGrid ?? []).filter((p) => !p.client_found).length

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

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Total backlinks"
          value={latestBacklinks?.total_backlinks ?? null}
        />
        <Kpi
          label="Referring domains"
          value={latestBacklinks?.referring_domains ?? null}
        />
        <Kpi label="Keywords in top 3" value={top3} />
        <Kpi label="Keywords in top 10" value={top10} />
      </div>

      {/* Plain-English insight blocks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InsightCard
          title="Backlinks"
          body={backlinkInsightCopy({
            newBacklinks: latestBacklinks?.new_backlinks ?? 0,
            lostBacklinks: latestBacklinks?.lost_backlinks ?? 0,
            newReferringDomains: latestBacklinks?.new_referring_domains ?? 0,
            lostReferringDomains: latestBacklinks?.lost_referring_domains ?? 0,
            spamScore: latestBacklinks?.backlink_spam_score ?? null,
          })}
        />
        <InsightCard
          title="Rankings"
          body={rankingInsightCopy({
            improved: 0, // refined when we add prev-month diff
            dropped: 0,
            top3,
            top10,
            total: latestRanks?.length ?? 0,
          })}
        />
        <InsightCard
          title="Maps coverage"
          body={mapsInsightCopy({
            totalGridPoints: latestGrid?.length ?? 0,
            top3Count: gridTop3,
            notFoundCount: gridNotFound,
          })}
        />
        <InsightCard
          title="AI visibility"
          body={aiVisibilityInsightCopy({
            mentions: (aiSnapshots ?? []).filter((a) => a.client_cited).length,
            citations: (aiSnapshots ?? []).filter((a) => a.client_cited).length,
            competitorMentions: 0,
          })}
        />
      </div>
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

function Kpi({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-body">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-heading">
          {value === null || value === undefined ? '—' : <NumberTicker value={value} />}
        </div>
      </CardContent>
    </Card>
  )
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-body">{body}</p>
      </CardContent>
    </Card>
  )
}
