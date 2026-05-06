import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { backlinkInsightCopy } from '@/lib/seo/insights'

export const dynamic = 'force-dynamic'

const INSIGHT_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' }> = {
  high_value: { label: 'High value', variant: 'default' },
  medium_value: { label: 'Medium', variant: 'secondary' },
  low_value: { label: 'Low value', variant: 'secondary' },
  nofollow: { label: 'Nofollow', variant: 'secondary' },
  redirect: { label: 'Redirect', variant: 'secondary' },
  spam: { label: 'Spam risk', variant: 'warning' },
}

export default async function SeoBacklinksPage({
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
    { data: latest },
    { data: history },
    { data: newRows },
    { data: lostRows },
  ] = await Promise.all([
    admin
      .from('dfs_backlink_snapshots')
      .select('total_backlinks, referring_domains, referring_main_domains, new_backlinks, lost_backlinks, new_referring_domains, lost_referring_domains, backlink_spam_score, snapshot_date')
      .eq('client_id', ctx.client.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('dfs_backlink_snapshots')
      .select('snapshot_date, total_backlinks, referring_domains, new_backlinks, lost_backlinks')
      .eq('client_id', ctx.client.id)
      .order('snapshot_date', { ascending: false })
      .limit(13),
    admin
      .from('dfs_backlink_rows')
      .select('domain_from, url_from, url_to, anchor, dofollow, domain_from_rank, insight_category, first_seen')
      .eq('client_id', ctx.client.id)
      .eq('month_key', monthKey)
      .eq('status', 'new')
      .order('domain_from_rank', { ascending: false, nullsFirst: false })
      .limit(50),
    admin
      .from('dfs_backlink_rows')
      .select('domain_from, url_from, url_to, anchor, dofollow, domain_from_rank, insight_category, last_seen')
      .eq('client_id', ctx.client.id)
      .eq('month_key', monthKey)
      .eq('status', 'lost')
      .order('domain_from_rank', { ascending: false, nullsFirst: false })
      .limit(50),
  ])

  if (!latest) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <EmptyState
          title="No backlink data yet"
          description="The first weekly sync runs every Monday at 4:00 AM UTC. Until then, ask the SEO team to trigger a manual refresh from the admin panel."
        />
      </div>
    )
  }

  const insight = backlinkInsightCopy({
    newBacklinks: latest.new_backlinks ?? 0,
    lostBacklinks: latest.lost_backlinks ?? 0,
    newReferringDomains: latest.new_referring_domains ?? 0,
    lostReferringDomains: latest.lost_referring_domains ?? 0,
    spamScore: latest.backlink_spam_score,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total backlinks" value={latest.total_backlinks} />
        <Stat label="Referring domains" value={latest.referring_domains} />
        <Stat label="New this month" value={latest.new_backlinks} positive />
        <Stat label="Lost this month" value={latest.lost_backlinks} negative />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this means</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-body">{insight}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New backlinks this month ({newRows?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!newRows || newRows.length === 0 ? (
            <EmptyState title="No new links yet this month" description="The next weekly sync will pull anything new." />
          ) : (
            <BacklinkTable rows={newRows} dateField="first_seen" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lost backlinks this month ({lostRows?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!lostRows || lostRows.length === 0 ? (
            <EmptyState title="No lost links — that's good" description="Nothing dropped off in the current month window." />
          ) : (
            <BacklinkTable rows={lostRows} dateField="last_seen" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent monthly snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-body">No history yet.</p>
          ) : (
            <ul className="divide-y divide-border-default text-sm">
              {history.map((h) => (
                <li key={h.snapshot_date} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-body">{h.snapshot_date}</span>
                  <span className="tabular-nums text-heading">
                    {h.total_backlinks?.toLocaleString()} backlinks · {h.referring_domains?.toLocaleString()} domains
                  </span>
                  <span className="text-xs text-body">
                    +{h.new_backlinks ?? 0} / -{h.lost_backlinks ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type BacklinkRow = {
  domain_from: string | null
  url_from: string | null
  url_to: string | null
  anchor: string | null
  dofollow: boolean | null
  domain_from_rank: number | null
  insight_category: string | null
}

function BacklinkTable({ rows, dateField }: { rows: Array<BacklinkRow & Record<string, unknown>>; dateField: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border-default text-sm">
        <thead className="text-left text-xs uppercase text-body">
          <tr>
            <th className="px-2 py-2">Source</th>
            <th className="px-2 py-2">Target</th>
            <th className="px-2 py-2">Anchor</th>
            <th className="px-2 py-2 text-right">Domain rank</th>
            <th className="px-2 py-2">Tag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {rows.map((r, idx) => {
            const tag = r.insight_category && INSIGHT_BADGES[r.insight_category]
            return (
              <tr key={idx} className="hover:bg-neutral-tertiary-soft">
                <td className="px-2 py-2 font-mono text-xs">
                  {r.domain_from ?? '—'}
                  {r.url_from && (
                    <a href={r.url_from} target="_blank" rel="noreferrer" className="ml-1 text-fg-brand hover:underline">
                      ↗
                    </a>
                  )}
                  <div className="text-[10px] text-body">
                    {r[dateField] ? new Date(r[dateField] as string).toISOString().slice(0, 10) : ''}
                  </div>
                </td>
                <td className="px-2 py-2 max-w-xs truncate text-xs" title={r.url_to ?? ''}>
                  {r.url_to ?? '—'}
                </td>
                <td className="px-2 py-2 max-w-[180px] truncate text-xs" title={r.anchor ?? ''}>
                  {r.anchor ?? '—'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.domain_from_rank ?? '—'}</td>
                <td className="px-2 py-2">
                  {tag ? <Badge variant={tag.variant}>{tag.label}</Badge> : null}
                  {r.dofollow === false ? <Badge variant="secondary" className="ml-1">nofollow</Badge> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stat({
  label,
  value,
  positive,
  negative,
}: {
  label: string
  value: number | null | undefined
  positive?: boolean
  negative?: boolean
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-body">{label}</div>
        <div
          className={
            'mt-1 text-2xl font-semibold tabular-nums ' +
            (positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-heading')
          }
        >
          {value === null || value === undefined ? '—' : value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
