import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NumberTicker } from '@/components/ui/number-ticker'
import { RingChart } from '@/components/ui/ring-chart'
import { EmptyIntegration } from '@/components/admin/empty-integration'
import { MapPin, Star, MessageSquare, FileText, Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { RefreshCitationsButton } from './refresh-citations-button'

export const dynamic = 'force-dynamic'

type CitationsRow = {
  health_score: number | null
  correct_count: number | null
  incorrect_count: number | null
  missing_count: number | null
  captured_on: string
}

type GmbRow = {
  rating: number | null
  review_count: number | null
  posts_30d: number | null
  views_30d: number | null
  searches_30d: number | null
  captured_on: string
}

type ReviewSummaryRow = {
  directory: string
  avg_rating: number | null
  review_count: number | null
  reviews_30d: number | null
  unanswered_count: number | null
}

type ReviewRow = {
  id: string
  directory: string
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_date: string | null
  responded: boolean | null
  review_url: string | null
}

const DIRECTORY_ICONS: Record<string, string> = {
  google:   '🔵',
  facebook: '🔷',
  yelp:     '🔴',
  avvo:     '⚖️',
  bbb:      '🛡️',
}

function StarRating({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'md' }) {
  if (rating == null) return <span className="text-body-subtle">—</span>
  const filled = Math.round(rating)
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(dim, n <= filled ? 'fill-amber-400 text-amber-400' : 'text-fg-disabled')}
        />
      ))}
      <span className={cn('ml-1.5 font-medium tabular-nums', size === 'sm' ? 'text-xs text-body' : 'text-base text-heading')}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

export default async function ClientLocalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [
    { data: client },
    { data: creds },
    { data: citations },
    { data: gmb },
    { data: directorySummary },
    { data: recentReviews },
  ] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa.from('client_credentials').select('brightlocal_client_id').eq('client_id', id).maybeSingle(),
    supa
      .from('citations')
      .select('health_score, correct_count, incorrect_count, missing_count, captured_on')
      .eq('client_id', id)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle<CitationsRow>(),
    supa
      .from('gmb_snapshots')
      .select('rating, review_count, posts_30d, views_30d, searches_30d, captured_on')
      .eq('client_id', id)
      .order('captured_on', { ascending: false })
      .limit(1)
      .maybeSingle<GmbRow>(),
    supa
      .from('review_summary')
      .select('directory, avg_rating, review_count, reviews_30d, unanswered_count')
      .eq('client_id', id)
      .order('captured_on', { ascending: false })
      .limit(20)
      .returns<ReviewSummaryRow[]>(),
    supa
      .from('reviews')
      .select('id, directory, reviewer_name, rating, review_text, review_date, responded, review_url')
      .eq('client_id', id)
      .order('review_date', { ascending: false })
      .limit(10)
      .returns<ReviewRow[]>(),
  ])

  if (!client) notFound()

  if (!creds?.brightlocal_client_id) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <EmptyIntegration
          clientId={id}
          serviceName="BrightLocal"
          reason="not_configured"
          helpText="Add this client's BrightLocal client ID in the credentials tab. Once set, citations / GMB / reviews update nightly."
        />
      </div>
    )
  }

  // Reduce review_summary to one row per directory — newest captured_on wins
  // (the order-desc + limit above already favors recent rows).
  const directoryByName = new Map<string, ReviewSummaryRow>()
  for (const s of directorySummary ?? []) {
    if (!directoryByName.has(s.directory)) directoryByName.set(s.directory, s)
  }
  const directories = Array.from(directoryByName.values())

  const totalCitations =
    (citations?.correct_count ?? 0) +
    (citations?.incorrect_count ?? 0) +
    (citations?.missing_count ?? 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Local SEO</h1>
          <p className="mt-1 text-sm text-body">
            {client.firm_name} · citations, Google Business, reviews
            {citations?.captured_on && <> · last pulled {new Date(citations.captured_on).toLocaleDateString()}</>}
          </p>
        </div>
        <RefreshCitationsButton clientId={id} />
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-6">
            <RingChart
              value={citations?.health_score ?? null}
              label="Citation health"
              size="sm"
            />
            <div className="leading-tight">
              <p className="text-xs font-medium uppercase tracking-wider text-body-subtle">
                Citation health
              </p>
              <p className="text-[11px] text-body-subtle mt-1">
                {totalCitations > 0
                  ? `${totalCitations} directories tracked`
                  : 'awaiting first pull'}
              </p>
            </div>
          </CardContent>
        </Card>

        <KpiCard
          label="GMB rating"
          value={gmb?.rating ?? null}
          subValue={gmb?.review_count ? `${gmb.review_count} reviews` : ''}
          Icon={Star}
          variant="warning"
          decimals={1}
        />
        <KpiCard
          label="GMB posts (30d)"
          value={gmb?.posts_30d ?? null}
          Icon={FileText}
          variant="brand"
        />
        <KpiCard
          label="Total review count"
          value={gmb?.review_count ?? null}
          Icon={MessageSquare}
          variant="info"
        />
      </div>

      {/* Citation breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Citation breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totalCitations === 0 ? (
            <p className="text-sm text-body">
              No citation data yet. The next BrightLocal pull (monthly schedule) will populate this.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-pill bg-neutral-tertiary-soft">
                {citations?.correct_count ? (
                  <div
                    className="bg-success transition-all"
                    style={{ width: `${(citations.correct_count / totalCitations) * 100}%` }}
                  />
                ) : null}
                {citations?.incorrect_count ? (
                  <div
                    className="bg-warning transition-all"
                    style={{ width: `${(citations.incorrect_count / totalCitations) * 100}%` }}
                  />
                ) : null}
                {citations?.missing_count ? (
                  <div
                    className="bg-danger transition-all"
                    style={{ width: `${(citations.missing_count / totalCitations) * 100}%` }}
                  />
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <CitationStat
                  Icon={Check}
                  label="Correct"
                  value={citations?.correct_count ?? 0}
                  total={totalCitations}
                  variant="success"
                />
                <CitationStat
                  Icon={AlertCircle}
                  label="Incorrect"
                  value={citations?.incorrect_count ?? 0}
                  total={totalCitations}
                  variant="warning"
                />
                <CitationStat
                  Icon={X}
                  label="Missing"
                  value={citations?.missing_count ?? 0}
                  total={totalCitations}
                  variant="danger"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Directory breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviews by directory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {directories.length === 0 ? (
            <p className="p-8 text-sm text-body">
              No directory summaries yet. Once BrightLocal data lands, you&apos;ll see per-platform
              ratings (Google, Facebook, Yelp, Avvo, BBB).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wider text-body">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Directory</th>
                  <th className="px-6 py-3 text-left font-medium">Rating</th>
                  <th className="px-6 py-3 text-right font-medium">Total</th>
                  <th className="px-6 py-3 text-right font-medium">Last 30d</th>
                  <th className="px-6 py-3 text-right font-medium">Unanswered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {directories.map((d) => (
                  <tr key={d.directory} className="transition-colors hover:bg-neutral-secondary-soft">
                    <td className="px-6 py-3 font-medium text-heading">
                      <span className="mr-2">{DIRECTORY_ICONS[d.directory.toLowerCase()] ?? '🌐'}</span>
                      {d.directory}
                    </td>
                    <td className="px-6 py-3"><StarRating rating={d.avg_rating} /></td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums text-heading">
                      {d.review_count ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums text-fg-success-strong">
                      {d.reviews_30d ? `+${d.reviews_30d}` : '0'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {d.unanswered_count ? (
                        <Badge variant="warning">{d.unanswered_count}</Badge>
                      ) : (
                        <span className="text-xs text-body-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent reviews feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentReviews?.length ?? 0) === 0 ? (
            <p className="text-sm text-body">
              No reviews pulled yet. The reviews cron runs nightly and will populate here as new
              reviews land across the connected directories.
            </p>
          ) : (
            <ul className="space-y-3">
              {(recentReviews ?? []).map((r) => (
                <li
                  key={r.id}
                  className="rounded-card border border-border-light p-4 transition-colors hover:bg-neutral-secondary-soft"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-body-subtle">
                          {DIRECTORY_ICONS[r.directory.toLowerCase()] ?? '🌐'} {r.directory}
                        </span>
                        <StarRating rating={r.rating} size="sm" />
                        <span className="text-xs text-body-subtle">
                          · {r.review_date ? new Date(r.review_date).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <p className="font-medium text-heading">{r.reviewer_name ?? 'Anonymous'}</p>
                      {r.review_text && (
                        <p className="mt-1 text-sm text-body line-clamp-2">{r.review_text}</p>
                      )}
                    </div>
                    {r.responded ? (
                      <Badge variant="success">Responded</Badge>
                    ) : (
                      <Badge variant="warning">Needs reply</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CitationStat({
  Icon,
  label,
  value,
  total,
  variant,
}: {
  Icon: typeof Check
  label: string
  value: number
  total: number
  variant: 'success' | 'warning' | 'danger'
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const styles = {
    success: 'text-fg-success-strong',
    warning: 'text-fg-warning',
    danger:  'text-fg-danger-strong',
  }[variant]

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', styles)} />
      <div className="leading-tight">
        <div className={cn('text-base font-semibold tabular-nums', styles)}>
          {value} <span className="text-xs font-normal text-body-subtle">({pct}%)</span>
        </div>
        <div className="text-[11px] text-body-subtle uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subValue,
  Icon,
  variant,
  decimals = 0,
}: {
  label: string
  value: number | null
  subValue?: string
  Icon: typeof MapPin
  variant: 'brand' | 'success' | 'info' | 'warning'
  decimals?: number
}) {
  const styles = {
    brand:   { chip: 'bg-brand-soft text-fg-brand-strong',     value: 'text-fg-brand-strong' },
    success: { chip: 'bg-success-soft text-fg-success-strong', value: 'text-fg-success-strong' },
    info:    { chip: 'bg-blue-100 text-blue-800',              value: 'text-blue-800' },
    warning: { chip: 'bg-warning-soft text-fg-warning',        value: 'text-fg-warning' },
  }[variant]

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-6">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-card', styles.chip)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-medium uppercase tracking-wider text-body-subtle">{label}</p>
          <p className={cn('mt-1 text-3xl font-semibold tabular-nums', styles.value)}>
            {value == null
              ? <span className="text-body-subtle">—</span>
              : <NumberTicker value={value} decimalPlaces={decimals} className="text-inherit" />}
          </p>
          {subValue && <p className="text-[11px] text-body-subtle">{subValue}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
