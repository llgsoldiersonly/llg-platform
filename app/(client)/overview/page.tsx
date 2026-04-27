import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

type DeliverableSummary = {
  id: string
  title: string
  source: 'package' | 'incentive' | 'custom'
  is_incentive: boolean
  status: string
  period_start: string
  period_end: string
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') sp.set(k, v)
  }

  const ctx = await getClientContext(sp)
  if (!ctx) redirect('/login')

  const supabase = await createClient()

  const subIds = ctx.selectedSubscriptions.map((s) => s.id)
  const today = new Date().toISOString().slice(0, 10)
  const { data: deliverables } = subIds.length > 0
    ? await supabase
        .from('deliverables_display')
        .select('id, title, source, is_incentive, status, period_start, period_end')
        .in('subscription_id', subIds)
        .lte('period_start', today)
        .gte('period_end', today)
        .eq('client_visible', true)
        .returns<DeliverableSummary[]>()
    : { data: [] }

  const dlist = deliverables ?? []
  const total = dlist.length
  const done = dlist.filter((d) => d.status === 'done').length
  const inProgress = dlist.filter((d) => d.status === 'in_progress').length
  const pending = dlist.filter((d) => d.status === 'pending').length
  const blocked = dlist.filter((d) => d.status === 'blocked').length
  const incentives = dlist.filter((d) => d.is_incentive)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {ctx.client.firm_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here's where your active work stands this period
          {ctx.selectedLocation && <> for {ctx.selectedLocation.label}</>}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active items" value={total} />
        <Kpi label="Done this period" value={done} variant="success" />
        <Kpi label="In progress" value={inProgress} variant="info" />
        <Kpi label="Blocked" value={blocked} variant={blocked > 0 ? 'destructive' : 'secondary'} />
      </div>

      {incentives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Free bonuses you're getting</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {incentives.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{d.title}</span>
                    <Badge variant="success">Free Bonus</Badge>
                  </div>
                  <Badge variant="secondary">{d.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Active subscriptions</CardTitle>
            <Link
              href="/plan"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            >
              View full plan <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {ctx.selectedSubscriptions.length === 0 ? (
            <p className="text-sm text-slate-500">No subscriptions for the current selection.</p>
          ) : (
            <ul className="space-y-2">
              {ctx.selectedSubscriptions.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Badge variant="info">{s.package?.code ?? '—'}</Badge>
                  <span className="text-sm text-slate-700">{s.package?.display_name ?? '—'}</span>
                  <span className="text-xs text-slate-400">started {s.started_at}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming in later phases</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-slate-500">
            <li>• Phase 5 — open a ticket if something's broken</li>
            <li>• Phase 6 — see your blog posts, calls, and social as they come in</li>
            <li>• Phase 7 — keyword ranking trends</li>
            <li>• Phase 8 — review feed across Google, Avvo, etc.</li>
          </ul>
        </CardContent>
      </Card>
      {pending > 0 && (
        <p className="text-center text-xs text-slate-400">
          {pending} item{pending === 1 ? '' : 's'} still pending kickoff
        </p>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'success' | 'info' | 'secondary' | 'destructive'
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        {variant && <Badge variant={variant} className="mt-2">{variant === 'success' ? 'on track' : variant === 'destructive' ? 'needs attention' : variant === 'info' ? 'active' : 'idle'}</Badge>}
      </CardContent>
    </Card>
  )
}
