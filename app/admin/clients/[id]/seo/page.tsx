import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { KeywordForm } from './seo-keyword-form'
import { CompetitorForm } from './seo-competitor-form'
import { MapGridForm } from './seo-grid-form'

export const dynamic = 'force-dynamic'

type ClientLocation = { id: string; label: string; city: string; state: string; lat: number | null; lng: number | null }

export default async function ClientSeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supa = createAdminClient()

  const { data: client } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain, vertical')
    .eq('id', id)
    .maybeSingle()
  if (!client) notFound()

  const [{ data: locations }, { data: keywords }, { data: competitors }, { data: gridPoints }, { data: usage }] =
    await Promise.all([
      supa
        .from('client_locations')
        .select('id, label, city, state, lat, lng')
        .eq('client_id', id)
        .order('is_primary', { ascending: false })
        .returns<ClientLocation[]>(),
      supa
        .from('dfs_tracked_keywords')
        .select('id, keyword, search_type, device, priority, location_name, is_active, created_at')
        .eq('client_id', id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
      supa
        .from('dfs_competitor_sites')
        .select('id, competitor_name, competitor_domain, city, state, is_active, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supa
        .from('dfs_map_grid_points')
        .select('id, client_location_id, label, lat, lng, radius_miles')
        .in(
          'client_location_id',
          // empty array → no rows; build it after we have locations.
          (await supa.from('client_locations').select('id').eq('client_id', id)).data?.map((l) => l.id) ?? ['__none__']
        ),
      // 30-day rolling spend.
      supa
        .from('dfs_usage_log')
        .select('endpoint, cost')
        .eq('client_id', id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

  const totalSpend30d = (usage ?? []).reduce((acc, r) => acc + Number(r.cost ?? 0), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <header>
        <h2 className="text-xl font-semibold text-heading">SEO Visibility — DataForSEO</h2>
        <p className="mt-1 text-sm text-body">
          Tracked keywords, competitors, and map-grid points feed the customer-facing SEO portal.
          {client.primary_domain ? null : (
            <span className="ml-1 text-amber-600">
              No <code className="rounded bg-neutral-tertiary-soft px-1">primary_domain</code> set on this client — backlink data
              cannot run until that's filled in on the Summary tab.
            </span>
          )}
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>30-day API spend</CardTitle>
          <span className="text-2xl font-semibold tabular-nums text-heading">${totalSpend30d.toFixed(2)}</span>
        </CardHeader>
        <CardContent className="text-xs text-body">
          {(usage ?? []).length} request{(usage ?? []).length === 1 ? '' : 's'} logged. Backlink summary is the most expensive
          call (~$0.02 each); SERP organic + maps are ~$0.002 each.
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- */}
      {/* TRACKED KEYWORDS                                      */}
      {/* ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked keywords ({keywords?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeywordForm clientId={id} locations={locations ?? []} />
          {(keywords?.length ?? 0) === 0 ? (
            <EmptyState
              title="No keywords tracked yet"
              description="Add a few high-priority keywords above. The bulk-import button uses law-firm templates and {city} substitution."
            />
          ) : (
            <div className="overflow-x-auto rounded border border-border-default">
              <table className="min-w-full divide-y divide-border-default text-sm">
                <thead className="bg-neutral-tertiary-soft text-left text-xs uppercase text-body">
                  <tr>
                    <th className="px-3 py-2">Keyword</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default bg-bg-base">
                  {(keywords ?? []).map((k) => (
                    <tr key={k.id}>
                      <td className="px-3 py-2 font-mono text-xs text-heading">{k.keyword}</td>
                      <td className="px-3 py-2">{k.search_type}</td>
                      <td className="px-3 py-2">{k.device}</td>
                      <td className="px-3 py-2">
                        <Badge variant={k.priority === 'high' ? 'warning' : 'secondary'}>{k.priority}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-body">{k.location_name ?? '—'}</td>
                      <td className="px-3 py-2">
                        {k.is_active ? <Badge>active</Badge> : <Badge variant="secondary">paused</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- */}
      {/* COMPETITORS                                           */}
      {/* ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Competitors ({competitors?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CompetitorForm clientId={id} />
          {(competitors?.length ?? 0) === 0 ? (
            <EmptyState
              title="No competitors yet"
              description="Add 3–5 local firms the SEO team would benchmark against. Backlink-gap analysis runs against this list."
            />
          ) : (
            <ul className="divide-y divide-border-default rounded border border-border-default">
              {(competitors ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-heading">{c.competitor_name}</div>
                    <div className="text-xs text-body">
                      {[c.competitor_domain, [c.city, c.state].filter(Boolean).join(', ')]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  {c.is_active ? <Badge>tracked</Badge> : <Badge variant="secondary">paused</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- */}
      {/* MAP GRID                                              */}
      {/* ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Map grid points ({gridPoints?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MapGridForm clientId={id} locations={locations ?? []} existingCount={gridPoints?.length ?? 0} />
          {(gridPoints?.length ?? 0) === 0 ? (
            <EmptyState
              title="No grid configured yet"
              description="Pick a location above and seed a 3×3 / 5×5 / 7×7 grid centered on its office. Each point becomes a Google Maps rank check on the weekly cron."
            />
          ) : (
            <p className="text-xs text-body">
              {gridPoints?.length} point{gridPoints?.length === 1 ? '' : 's'} configured across{' '}
              {new Set((gridPoints ?? []).map((g) => g.client_location_id)).size} location
              {new Set((gridPoints ?? []).map((g) => g.client_location_id)).size === 1 ? '' : 's'}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
