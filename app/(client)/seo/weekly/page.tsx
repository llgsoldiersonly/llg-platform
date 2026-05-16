import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText, TrendingUp, TrendingDown, Target, ListChecks, History } from 'lucide-react'
import { scoreLabel } from '@/lib/seo/scoring'

export const dynamic = 'force-dynamic'

type WeeklyRow = {
  id: string
  week_key: string
  period_start: string
  period_end: string
  search_visibility_score: number | null
  maps_score: number | null
  organic_score: number | null
  ai_visibility_score: number | null
  review_score: number | null
  competitor_gap_score: number | null
  wins: unknown
  losses: unknown
  recommended_actions: unknown
  executive_summary: string | null
  key_points: unknown
  last_month_recap: string | null
  created_at: string
}

function fmtWeek(row: Pick<WeeklyRow, 'week_key' | 'period_start' | 'period_end'>): string {
  const start = new Date(row.period_start + 'T00:00:00Z')
  const end = new Date(row.period_end + 'T00:00:00Z')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const startStr = start.toLocaleDateString('en-US', opts)
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${row.week_key} · ${startStr} – ${endStr}`
}

export default async function SeoWeeklyReportPage({
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

  const { data: reports } = await admin
    .from('dfs_seo_weekly_reports')
    .select(
      'id, week_key, period_start, period_end, search_visibility_score, maps_score, organic_score, ai_visibility_score, review_score, competitor_gap_score, wins, losses, recommended_actions, executive_summary, key_points, last_month_recap, created_at'
    )
    .eq('client_id', ctx.client.id)
    .order('week_key', { ascending: false })
    .limit(12)
    .returns<WeeklyRow[]>()

  const latest = reports?.[0] ?? null
  const archive = (reports ?? []).slice(1)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Weekly Report</h1>
        <p className="mt-1 text-sm text-body">
          Where the work moved last week — quick wins, what slipped, and what we&apos;re doing next.
          Finalized every Monday morning.
        </p>
      </div>

      {!latest ? (
        <EmptyState
          icon={FileText}
          title="No weekly reports yet"
          description="The first weekly report finalizes the upcoming Monday, after a full ISO week of fresh ranking, citation, and review data. After that, you'll see a new edition here every week."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-lg">{fmtWeek(latest)}</CardTitle>
                <Badge variant="secondary">Finalized {new Date(latest.created_at).toLocaleDateString()}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {latest.executive_summary && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-body-subtle">Executive summary</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">
                    {latest.executive_summary}
                  </p>
                </div>
              )}

              <KeyPointsSection items={asArray(latest.key_points)} />

              <LastMonthRecapSection recap={latest.last_month_recap} />

              <div>
                <h3 className="text-xs uppercase tracking-wider text-body-subtle">Scores</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <ScoreTile label="Visibility" value={latest.search_visibility_score} />
                  <ScoreTile label="Maps" value={latest.maps_score} />
                  <ScoreTile label="Organic" value={latest.organic_score} />
                  <ScoreTile label="AI visibility" value={latest.ai_visibility_score} />
                  <ScoreTile label="Reviews" value={latest.review_score} />
                  <ScoreTile label="Competitor gap" value={latest.competitor_gap_score} />
                </div>
              </div>

              <Section icon={TrendingUp} title="Wins" items={asArray(latest.wins)} tone="emerald" />
              <Section icon={TrendingDown} title="Losses" items={asArray(latest.losses)} tone="amber" />
              <Section
                icon={Target}
                title="What we're doing about it"
                items={asArray(latest.recommended_actions)}
                tone="brand"
              />
            </CardContent>
          </Card>

          {archive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past weeks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-light">
                  {archive.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <Link
                        href={`/seo/weekly?week=${r.week_key}`}
                        className="text-sm font-medium text-heading hover:text-fg-brand"
                      >
                        {fmtWeek(r)}
                      </Link>
                      <span className="text-xs text-body">
                        {r.search_visibility_score !== null
                          ? `Visibility ${r.search_visibility_score} · ${scoreLabel(r.search_visibility_score)}`
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function KeyPointsSection({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-fg-brand" />
        <h3 className="text-sm font-semibold text-fg-brand">Key points</h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-snug text-body">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LastMonthRecapSection({ recap }: { recap: string | null }) {
  if (!recap) return null
  return (
    <div className="rounded-md border border-border-light bg-neutral-tertiary-soft/40 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-body" />
        <h3 className="text-sm font-semibold text-heading">Last month recap</h3>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">{recap}</p>
    </div>
  )
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border border-border-default p-3">
      <div className="text-xs uppercase tracking-wide text-body">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-heading">
          {value === null ? '—' : value}
        </span>
        <span className="text-xs text-body">{scoreLabel(value)}</span>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof TrendingUp
  title: string
  items: string[]
  tone: 'emerald' | 'amber' | 'brand'
}) {
  if (items.length === 0) return null
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-fg-brand'
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneClass}`} />
        <h3 className={`text-sm font-semibold ${toneClass}`}>{title}</h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-snug text-body">
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
