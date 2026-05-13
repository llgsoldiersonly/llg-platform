import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Users, ExternalLink, TrendingUp } from 'lucide-react'
import {
  buildCompetitorStats,
  actionLineForCompetitor,
  type CompetitorStats,
} from '@/lib/seo/competitor-stats'

export const dynamic = 'force-dynamic'

export default async function SeoCompetitorsPage({
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
  const stats = await buildCompetitorStats(admin, ctx.client.id)
  const active = stats.filter((c) => c.is_active)
  const inactive = stats.filter((c) => !c.is_active)

  // Roll-up so the client sees overall pressure at a glance.
  const totalOutranks = active.reduce((sum, c) => sum + c.times_outranking, 0)
  const totalOverlaps = active.reduce((sum, c) => sum + c.keywords_overlapped, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Competitors</h1>
        <p className="mt-1 text-sm text-body">
          Local firms ranking against you on the keywords we track. Stats below come from
          this month&apos;s SERP snapshots — no manual configuration needed.
        </p>
      </div>

      {stats.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No competitors set yet"
          description="Competitors are auto-discovered each month from your SERP rankings. As soon as the first cycle runs, the firms repeatedly appearing alongside you will populate here."
        />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Kpi label="Active competitors" value={active.length} />
                <Kpi label="Overlapping keywords" value={totalOverlaps} suffix=" total" />
                <Kpi
                  label="Times outranked"
                  value={totalOutranks}
                  suffix={totalOverlaps > 0 ? ` / ${totalOverlaps}` : ''}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tracking ({active.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border-light">
                    {active
                      .sort((a, b) => b.times_outranking - a.times_outranking)
                      .map((c) => (
                        <CompetitorRowView key={c.competitor_id} s={c} />
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}

          {inactive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No longer tracked ({inactive.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-light opacity-60">
                  {inactive.map((c) => (
                    <CompetitorRowView key={c.competitor_id} s={c} />
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

function Kpi({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-body">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-heading">
          {value}
          {suffix && <span className="text-base font-normal text-body">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function CompetitorRowView({ s }: { s: CompetitorStats }) {
  return (
    <li className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-heading">{s.competitor_name}</span>
            {!s.is_active && <Badge variant="secondary">paused</Badge>}
            {s.competitor_domain && (
              <a
                href={
                  s.competitor_domain.startsWith('http')
                    ? s.competitor_domain
                    : `https://${s.competitor_domain}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline"
              >
                {s.competitor_domain.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="mt-2 text-sm leading-snug text-body">{actionLineForCompetitor(s)}</p>

          {s.top_close_gap_keywords.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-body-subtle">
                Closest gaps to close
              </div>
              <ul className="mt-1 space-y-1">
                {s.top_close_gap_keywords.map((k, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-body">
                    <TrendingUp className="h-3 w-3 text-amber-600" />
                    <span className="text-heading">{k.keyword}</span>
                    <span className="text-body-subtle">
                      — they&apos;re at #{k.competitor_rank}
                      {k.client_rank !== null ? `, you're at #${k.client_rank}` : ", you're not in top 100"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-body-subtle">Outranking</div>
          <div className="text-2xl font-semibold tabular-nums text-heading">
            {s.times_outranking}
            <span className="text-sm font-normal text-body"> / {s.keywords_overlapped}</span>
          </div>
          {s.avg_rank_gap !== null && (
            <div className="mt-1 text-xs text-body">
              avg {s.avg_rank_gap > 0 ? '+' : ''}
              {s.avg_rank_gap} pos gap
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
