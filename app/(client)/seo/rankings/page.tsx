import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { rankingInsightCopy } from '@/lib/seo/insights'

export const dynamic = 'force-dynamic'

type RankRow = {
  tracked_keyword_id: string
  keyword: string
  search_type: string
  device: string | null
  location_name: string | null
  rank_absolute: number | null
  rank_group: number | null
  is_client_ranking: boolean | null
  url: string | null
  snapshot_date: string
}

function rankBadge(rank: number | null) {
  if (rank === null) return { label: 'Not in top 100', variant: 'secondary' as const, color: 'text-body' }
  if (rank <= 3) return { label: `#${rank}`, variant: 'default' as const, color: 'text-emerald-600' }
  if (rank <= 10) return { label: `#${rank}`, variant: 'default' as const, color: 'text-amber-600' }
  if (rank <= 20) return { label: `#${rank}`, variant: 'secondary' as const, color: 'text-amber-700' }
  return { label: `#${rank}`, variant: 'secondary' as const, color: 'text-body' }
}

export default async function SeoRankingsPage({
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

  // Latest rank per (tracked_keyword × search_type) using a window over snapshot_date.
  // Postgres has window-function support but the JS client can't ORDER BY window
  // results directly — we fetch the most recent 90d and dedupe in code instead.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: snapshots } = await admin
    .from('dfs_keyword_rank_snapshots')
    .select('tracked_keyword_id, keyword, search_type, device, location_name, rank_absolute, rank_group, is_client_ranking, url, snapshot_date')
    .eq('client_id', ctx.client.id)
    .gte('snapshot_date', ninetyDaysAgo)
    .order('snapshot_date', { ascending: false })
    .returns<RankRow[]>()

  const latestByKeyword = new Map<string, RankRow>()
  const previousByKeyword = new Map<string, RankRow>()
  for (const row of snapshots ?? []) {
    const key = `${row.tracked_keyword_id}::${row.search_type}::${row.device ?? ''}`
    if (!latestByKeyword.has(key)) {
      latestByKeyword.set(key, row)
    } else if (!previousByKeyword.has(key)) {
      previousByKeyword.set(key, row)
    }
  }

  const latest = Array.from(latestByKeyword.values()).sort((a, b) => {
    // Sort: client ranking first, then by rank ascending.
    const ar = a.rank_absolute ?? 999
    const br = b.rank_absolute ?? 999
    return ar - br
  })

  const top3 = latest.filter((r) => (r.rank_absolute ?? 99) <= 3).length
  const top10 = latest.filter((r) => (r.rank_absolute ?? 99) <= 10).length
  let improved = 0
  let dropped = 0
  for (const [key, current] of latestByKeyword) {
    const prev = previousByKeyword.get(key)
    if (!prev || current.rank_absolute === null || prev.rank_absolute === null) continue
    if (current.rank_absolute < prev.rank_absolute) improved += 1
    else if (current.rank_absolute > prev.rank_absolute) dropped += 1
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Tracked keywords" value={latest.length} />
        <Stat label="Top 3" value={top3} accent="emerald" />
        <Stat label="Top 10" value={top10} accent="amber" />
        <Stat label="Improved this month" value={improved} accent="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this means</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-body">
            {rankingInsightCopy({ improved, dropped, top3, top10, total: latest.length })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyword rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {latest.length === 0 ? (
            <EmptyState
              title="No keywords tracked yet"
              description="The SEO team adds keywords on the admin side. Once they do, weekly rank checks will populate this table automatically."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-default text-sm">
                <thead className="text-left text-xs uppercase text-body">
                  <tr>
                    <th className="px-2 py-2">Keyword</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Current rank</th>
                    <th className="px-2 py-2">Change</th>
                    <th className="px-2 py-2">URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {latest.map((r) => {
                    const key = `${r.tracked_keyword_id}::${r.search_type}::${r.device ?? ''}`
                    const prev = previousByKeyword.get(key)
                    const delta =
                      prev && prev.rank_absolute !== null && r.rank_absolute !== null
                        ? prev.rank_absolute - r.rank_absolute
                        : null
                    const badge = rankBadge(r.rank_absolute)
                    return (
                      <tr key={key} className="hover:bg-neutral-tertiary-soft">
                        <td className="px-2 py-2 font-mono text-xs text-heading">{r.keyword}</td>
                        <td className="px-2 py-2 text-xs text-body">
                          {r.search_type}
                          {r.device ? <span className="ml-1 text-body-subtle">/ {r.device}</span> : null}
                        </td>
                        <td className="px-2 py-2 text-xs text-body">{r.location_name ?? '—'}</td>
                        <td className={'px-2 py-2 font-medium tabular-nums ' + badge.color}>{badge.label}</td>
                        <td className="px-2 py-2 text-xs">
                          {delta === null ? (
                            <span className="text-body-subtle">—</span>
                          ) : delta > 0 ? (
                            <span className="text-emerald-600">▲ {delta}</span>
                          ) : delta < 0 ? (
                            <span className="text-rose-600">▼ {Math.abs(delta)}</span>
                          ) : (
                            <span className="text-body">flat</span>
                          )}
                        </td>
                        <td className="px-2 py-2 max-w-xs truncate text-xs" title={r.url ?? ''}>
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="text-fg-brand hover:underline">
                              {r.url.replace(/^https?:\/\//, '').slice(0, 40)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'emerald' | 'amber' | 'rose'
}) {
  const cls =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'amber'
      ? 'text-amber-600'
      : accent === 'rose'
      ? 'text-rose-600'
      : 'text-heading'
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-body">{label}</div>
        <div className={'mt-1 text-2xl font-semibold tabular-nums ' + cls}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  )
}
