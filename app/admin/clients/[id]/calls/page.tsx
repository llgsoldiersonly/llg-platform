import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyIntegration } from '@/components/admin/empty-integration'

export const dynamic = 'force-dynamic'

type Call = {
  id: string
  external_id: string
  duration: number | null
  source: string | null
  tracker: string | null
  recording_url: string | null
  caller_name: string | null
  caller_number: string | null
  first_call: boolean | null
  agent_email: string | null
  started_at: string | null
}

export default async function ClientCallsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: creds }, { data: calls }] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa
      .from('client_credentials')
      .select('callrail_account_id, callrail_company_id')
      .eq('client_id', id)
      .maybeSingle(),
    supa
      .from('calls')
      .select('id, external_id, duration, source, tracker, recording_url, caller_name, caller_number, first_call, agent_email, started_at')
      .eq('client_id', id)
      .order('started_at', { ascending: false })
      .limit(100)
      .returns<Call[]>(),
  ])

  if (!client) notFound()

  const isConfigured = !!creds?.callrail_company_id

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration
          clientId={id}
          serviceName="CallRail"
          reason="not_configured"
          helpText="Add the CallRail Company ID for this client. The shared LLG account ID fills in automatically — you only need the per-client company ID."
        />
      </div>
    )
  }

  const list = calls ?? []
  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration clientId={id} serviceName="CallRail" reason="no_data" />
      </div>
    )
  }

  // Quick stats
  const totalCalls = list.length
  const firstCalls = list.filter((c) => c.first_call).length
  const totalDuration = list.reduce((s, c) => s + (c.duration ?? 0), 0)
  const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Calls (last 100)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">{totalCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">First-time callers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">{firstCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Avg duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">
              {Math.floor(avgDuration / 60)}:{String(avgDuration % 60).padStart(2, '0')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-6 py-3 text-left font-medium">When</th>
                <th className="px-6 py-3 text-left font-medium">Caller</th>
                <th className="px-6 py-3 text-left font-medium">Source</th>
                <th className="px-6 py-3 text-left font-medium">Tracker</th>
                <th className="px-6 py-3 text-left font-medium">Duration</th>
                <th className="px-6 py-3 text-left font-medium">First?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-3 text-xs text-body">
                    {c.started_at ? new Date(c.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-heading">{c.caller_name ?? '—'}</div>
                    <div className="text-xs text-body">{c.caller_number ?? '—'}</div>
                  </td>
                  <td className="px-6 py-3 text-body">{c.source ?? '—'}</td>
                  <td className="px-6 py-3 text-body">{c.tracker ?? '—'}</td>
                  <td className="px-6 py-3 text-body">
                    {c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : '—'}
                  </td>
                  <td className="px-6 py-3">
                    {c.first_call && <Badge variant="success">First</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
