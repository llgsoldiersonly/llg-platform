import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyIntegration } from '@/components/admin/empty-integration'

export const dynamic = 'force-dynamic'

type SocialStat = {
  channel: string
  period_start: string
  period_end: string
  followers: number | null
  reach: number | null
  impressions: number | null
  posts_count: number | null
  ad_spend_cents: number | null
}

export default async function ClientSocialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: creds }, { data: stats }] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa
      .from('client_credentials')
      .select('metricool_user_id, metricool_blog_id')
      .eq('client_id', id)
      .maybeSingle(),
    supa
      .from('social_stats')
      .select('channel, period_start, period_end, followers, reach, impressions, posts_count, ad_spend_cents')
      .eq('client_id', id)
      .order('period_start', { ascending: false })
      .limit(60)
      .returns<SocialStat[]>(),
  ])

  if (!client) notFound()

  const isConfigured = !!(creds?.metricool_user_id && creds?.metricool_blog_id)

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration
          clientId={id}
          serviceName="Metricool"
          reason="not_configured"
          helpText="Add the client's Metricool user_id + blog_id (both shown in the Metricool URL when you're viewing their account)."
        />
      </div>
    )
  }

  const list = stats ?? []
  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration clientId={id} serviceName="Metricool" reason="no_data" />
      </div>
    )
  }

  // Aggregate latest per-channel stats
  const latest: Record<string, SocialStat> = {}
  for (const s of list) {
    if (!latest[s.channel] || s.period_start > latest[s.channel].period_start) {
      latest[s.channel] = s
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(latest).map(([channel, s]) => (
          <Card key={channel}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">{channel}</CardTitle>
                <Badge variant="secondary">{s.period_start}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1 text-sm">
                <Row label="Followers" value={s.followers} />
                <Row label="Reach" value={s.reach} />
                <Row label="Impressions" value={s.impressions} />
                <Row label="Posts" value={s.posts_count} />
                {s.ad_spend_cents != null && s.ad_spend_cents > 0 && (
                  <Row label="Ad spend" value={`$${(s.ad_spend_cents / 100).toLocaleString()}`} />
                )}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historical periods (last 60 entries)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Period</th>
                <th className="px-6 py-3 text-left font-medium">Channel</th>
                <th className="px-6 py-3 text-right font-medium">Followers</th>
                <th className="px-6 py-3 text-right font-medium">Reach</th>
                <th className="px-6 py-3 text-right font-medium">Posts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((s, i) => (
                <tr key={`${s.channel}-${s.period_start}-${i}`}>
                  <td className="px-6 py-3 text-xs text-slate-600">
                    {s.period_start} → {s.period_end}
                  </td>
                  <td className="px-6 py-3 capitalize">{s.channel}</td>
                  <td className="px-6 py-3 text-right">{s.followers ?? '—'}</td>
                  <td className="px-6 py-3 text-right">{s.reach ?? '—'}</td>
                  <td className="px-6 py-3 text-right">{s.posts_count ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}
