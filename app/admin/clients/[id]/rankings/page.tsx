import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NumberTicker } from '@/components/ui/number-ticker'
import { EmptyIntegration } from '@/components/admin/empty-integration'
import { Search, TrendingUp, Trophy, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

type TrackedKeyword = {
  id: string
  keyword: string
  device: 'desktop' | 'mobile'
  is_priority: boolean
}

type RankingRow = {
  keyword: string
  position: number | null
  position_mobile: number | null
  position_local_finder: number | null
  position_change: number | null
  url: string | null
  captured_on: string
}

function rankBand(pos: number | null): { bg: string; text: string; label: string } {
  if (pos == null) return { bg: 'bg-neutral-tertiary-soft', text: 'text-body-subtle', label: '—' }
  if (pos <= 3) return { bg: 'bg-success-soft', text: 'text-fg-success-strong', label: String(pos) }
  if (pos <= 10) return { bg: 'bg-warning-soft', text: 'text-fg-warning', label: String(pos) }
  return { bg: 'bg-neutral-tertiary-soft', text: 'text-body', label: String(pos) }
}

function ChangeIndicator({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <Minus className="h-3.5 w-3.5 text-body-subtle" />
  }
  // Lower position is better — a NEGATIVE delta means the position number went down (e.g. 5 → 3) which is GOOD
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-fg-success-strong">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {Math.abs(delta)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-fg-danger-strong">
      <ArrowDownRight className="h-3.5 w-3.5" />
      {delta}
    </span>
  )
}

export default async function ClientRankingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: creds }, { data: trackedRaw }, { data: rankingsRaw }] =
    await Promise.all([
      supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
      supa
        .from('client_credentials')
        .select('brightlocal_client_id')
        .eq('client_id', id)
        .maybeSingle(),
      supa
        .from('tracked_keywords')
        .select('id, keyword, device, is_priority')
        .eq('client_id', id)
        .returns<TrackedKeyword[]>(),
      supa
        .from('rankings_daily')
        .select('keyword, position, position_mobile, position_local_finder, position_change, url, captured_on')
        .eq('client_id', id)
        .order('captured_on', { ascending: false })
        .limit(500)
        .returns<RankingRow[]>(),
    ])

  if (!client) notFound()

  if (!creds?.brightlocal_client_id) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <EmptyIntegration
          clientId={id}
          serviceName="BrightLocal"
          reason="not_configured"
          helpText="Add this client's BrightLocal client ID in the credentials tab. Once set, rankings update weekly."
        />
      </div>
    )
  }

  // Reduce rankings_daily to one row per keyword — newest captured_on wins.
  const latestByKeyword = new Map<string, RankingRow>()
  for (const r of rankingsRaw ?? []) {
    if (!latestByKeyword.has(r.keyword)) latestByKeyword.set(r.keyword, r)
  }
  const rankings = Array.from(latestByKeyword.values())
  const tracked = trackedRaw ?? []

  const totalKeywords = Math.max(tracked.length, rankings.length)
  const top10Count = rankings.filter((r) => r.position != null && r.position <= 10).length
  const top3Count = rankings.filter((r) => r.position != null && r.position <= 3).length

  const positions = rankings.map((r) => r.position).filter((p): p is number => p != null)
  const avgPosition = positions.length > 0
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
    : null

  const movement = rankings
    .map((r) => r.position_change)
    .filter((c): c is number => c != null)
    .reduce((sum, c) => sum + c, 0)

  const lastCapture = rankings[0]?.captured_on ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Keyword rankings</h1>
          <p className="mt-1 text-sm text-body">
            {client.firm_name} · sourced from BrightLocal
            {lastCapture && <> · last pulled {new Date(lastCapture).toLocaleDateString()}</>}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Keywords tracked"
          value={totalKeywords}
          Icon={Search}
          variant="brand"
        />
        <KpiCard
          label="Avg position"
          value={avgPosition}
          Icon={TrendingUp}
          variant="info"
          decimals={1}
        />
        <KpiCard
          label="In top 10"
          value={top10Count}
          Icon={Trophy}
          variant={top10Count > 0 ? 'success' : 'warning'}
          subValue={`${top3Count} in top 3`}
        />
        <KpiCard
          label="Movement (this pull)"
          value={Math.abs(movement)}
          Icon={movement < 0 ? ArrowUpRight : ArrowDownRight}
          variant={movement < 0 ? 'success' : movement > 0 ? 'warning' : 'info'}
          subValue={movement === 0 ? 'no change' : movement < 0 ? 'positions gained' : 'positions lost'}
        />
      </div>

      {/* Rankings table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracked keywords ({rankings.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rankings.length === 0 ? (
            <p className="p-8 text-center text-sm text-body">
              No ranking data yet. The next BrightLocal pull will populate this table.
              Weekly schedule: Mon 02:00 UTC.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wider text-body">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Keyword</th>
                  <th className="px-3 py-3 text-center font-medium">Desktop</th>
                  <th className="px-3 py-3 text-center font-medium">Mobile</th>
                  <th className="px-3 py-3 text-center font-medium">Local pack</th>
                  <th className="px-3 py-3 text-center font-medium">Δ</th>
                  <th className="px-6 py-3 text-left font-medium">Landing URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {rankings.map((r) => {
                  const desktopBand = rankBand(r.position)
                  const mobileBand = rankBand(r.position_mobile)
                  const localBand = rankBand(r.position_local_finder)
                  return (
                    <tr key={r.keyword} className="transition-colors hover:bg-neutral-secondary-soft">
                      <td className="px-6 py-3 font-medium text-heading">{r.keyword}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex h-7 min-w-9 items-center justify-center rounded-pill px-2 text-xs font-semibold', desktopBand.bg, desktopBand.text)}>
                          {desktopBand.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex h-7 min-w-9 items-center justify-center rounded-pill px-2 text-xs font-semibold', mobileBand.bg, mobileBand.text)}>
                          {mobileBand.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex h-7 min-w-9 items-center justify-center rounded-pill px-2 text-xs font-semibold', localBand.bg, localBand.text)}>
                          {localBand.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ChangeIndicator delta={r.position_change} />
                      </td>
                      <td className="px-6 py-3">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-fg-brand hover:underline">
                            {r.url.replace(/^https?:\/\//, '').slice(0, 50)}
                          </a>
                        ) : (
                          <span className="text-xs text-body-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Tracked keyword list (when no rankings yet) */}
      {rankings.length === 0 && tracked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracked keyword list ({tracked.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tracked.map((k) => (
                <Badge key={k.id} variant={k.is_priority ? 'brand' : 'gray'}>
                  {k.keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How rankings work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-body">
          <p>
            <strong className="text-heading">Color bands:</strong>{' '}
            <span className="rounded-pill bg-success-soft px-1.5 text-xs text-fg-success-strong">1–3</span>{' '}
            page-1 highlight,{' '}
            <span className="rounded-pill bg-warning-soft px-1.5 text-xs text-fg-warning">4–10</span>{' '}
            page 1,{' '}
            <span className="rounded-pill bg-neutral-tertiary-soft px-1.5 text-xs text-body">11+</span>{' '}
            page 2 or beyond.
          </p>
          <p>
            <strong className="text-heading">Δ column:</strong> change vs the prior pull. A green up-arrow
            means the position number went DOWN (better rank). A red down-arrow means rank dropped.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  Icon,
  variant,
  subValue,
  decimals = 0,
}: {
  label: string
  value: number | null
  Icon: typeof Search
  variant: 'brand' | 'success' | 'info' | 'warning'
  subValue?: string
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
