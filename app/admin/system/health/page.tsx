import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { classify, relativeAge, type Health } from '@/lib/health'

export const dynamic = 'force-dynamic'

// Each row: a cron source we want to track per-client.
// `expectedHours` drives green/yellow/red thresholds:
//   green  < expectedHours
//   yellow < expectedHours * 2
//   red    >= expectedHours * 2  (or never synced)
const INTEGRATIONS: Array<{
  source: string
  label: string
  cadence: 'daily' | 'weekly' | 'monthly'
  expectedHours: number
}> = [
  { source: 'cron:wordpress',  label: 'WordPress',  cadence: 'daily',   expectedHours: 24 },
  { source: 'cron:callrail',   label: 'CallRail',   cadence: 'daily',   expectedHours: 24 },
  { source: 'cron:metricool',  label: 'Metricool',  cadence: 'daily',   expectedHours: 24 },
  { source: 'cron:reviews',    label: 'Reviews',    cadence: 'daily',   expectedHours: 24 },
  { source: 'cron:rankings',   label: 'Rankings',   cadence: 'weekly',  expectedHours: 24 * 8 },
  { source: 'cron:lighthouse', label: 'Lighthouse', cadence: 'weekly',  expectedHours: 24 * 8 },
  { source: 'cron:citations',  label: 'Citations',  cadence: 'monthly', expectedHours: 24 * 35 },
]

const CELL_STYLES: Record<Health, string> = {
  green:  'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  red:    'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
  never:  'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

export default async function SystemHealthPage() {
  const supa = createAdminClient()

  const [{ data: clients }, { data: latestSyncs }] = await Promise.all([
    supa
      .from('clients')
      .select('id, firm_name, status, is_demo_only')
      .neq('status', 'churned')
      .eq('is_demo_only', false)
      .order('firm_name'),
    // For each (client_id, source) pull the most recent successful sync. We
    // pull a 90-day window to avoid scanning the whole table — anything
    // older than 90 days is already 'red' for any cadence we care about.
    supa
      .from('sync_log')
      .select('client_id, source, status, created_at')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 3_600_000).toISOString())
      .eq('status', 'ok')
      .order('created_at', { ascending: false }),
  ])

  // Build (client_id, source) → last_ok_at lookup, picking the newest row
  // we see first (since results are ordered desc).
  const lastOk = new Map<string, string>()
  for (const row of latestSyncs ?? []) {
    if (!row.client_id) continue
    const key = `${row.client_id}::${row.source}`
    if (!lastOk.has(key)) lastOk.set(key, row.created_at as string)
  }

  // Aggregate counts for the legend cards
  const totals = { green: 0, yellow: 0, red: 0, never: 0 }
  for (const c of clients ?? []) {
    for (const it of INTEGRATIONS) {
      const last = lastOk.get(`${c.id}::${it.source}`) ?? null
      totals[classify(last, it.expectedHours)]++
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">System health</h1>
        <p className="mt-1 text-sm text-slate-600">
          Last successful sync per client × integration. Green is fresh; yellow is overdue; red is stale or never synced.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <HealthCount label="Healthy"  count={totals.green}  variant="green" />
        <HealthCount label="Overdue"  count={totals.yellow} variant="yellow" />
        <HealthCount label="Stale"    count={totals.red}    variant="red" />
        <HealthCount label="No data"  count={totals.never}  variant="never" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                    Client
                  </th>
                  {INTEGRATIONS.map((it) => (
                    <th
                      key={it.source}
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600"
                    >
                      <div>{it.label}</div>
                      <div className="text-[10px] font-normal normal-case text-slate-500">{it.cadence}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(clients ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-6 py-3 font-medium text-slate-900">
                      <Link href={`/admin/clients/${c.id}`} className="hover:underline">
                        {c.firm_name}
                      </Link>
                      {c.status === 'onboarding' && (
                        <Badge variant="warning" className="ml-2 align-middle text-[10px]">Onboarding</Badge>
                      )}
                    </td>
                    {INTEGRATIONS.map((it) => {
                      const last = lastOk.get(`${c.id}::${it.source}`) ?? null
                      const health = classify(last, it.expectedHours)
                      return (
                        <td key={it.source} className="px-3 py-3">
                          <div
                            className={cn(
                              'inline-flex flex-col rounded-md px-2.5 py-1 text-xs font-medium',
                              CELL_STYLES[health]
                            )}
                            title={last ? `Last ok: ${new Date(last).toLocaleString()}` : 'No successful sync recorded'}
                          >
                            <span>{relativeAge(last)}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {(clients ?? []).length === 0 && (
                  <tr>
                    <td colSpan={INTEGRATIONS.length + 1} className="px-6 py-8 text-center text-sm text-slate-600">
                      No active clients to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How thresholds work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <ul className="space-y-1">
            <li>
              <span className="inline-flex w-20 text-xs font-medium uppercase text-emerald-700">Green</span>
              within one expected interval (24h daily / 8d weekly / 35d monthly)
            </li>
            <li>
              <span className="inline-flex w-20 text-xs font-medium uppercase text-amber-700">Yellow</span>
              one to two intervals stale
            </li>
            <li>
              <span className="inline-flex w-20 text-xs font-medium uppercase text-red-700">Red</span>
              two or more intervals stale
            </li>
            <li>
              <span className="inline-flex w-20 text-xs font-medium uppercase text-slate-600">No data</span>
              no successful sync in the last 90 days (often: credentials not yet configured)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function HealthCount({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: Health
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-semibold', {
          'text-emerald-700': variant === 'green',
          'text-amber-700':   variant === 'yellow',
          'text-red-700':     variant === 'red',
          'text-slate-600':   variant === 'never',
        })}>
          {count}
        </p>
      </CardContent>
    </Card>
  )
}
