import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { canAccessIntakes } from '@/lib/actions/intakes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTip } from '@/components/ui/infotip'
import { IntakeModePicker } from './intake-mode-picker'

export const dynamic = 'force-dynamic'

type ClientRow = { id: string; firm_name: string; status: string; intake_mode: string }
type LeadAgg = { client_id: string; status: string; created_at: string }

const MODE_LABEL: Record<string, string> = {
  intakes_only: 'Intakes only',
  intakes_leads: 'Intakes + Leads',
}

export default async function IntakesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/intakes')

  const admin = createAdminClient()
  if (!(await canAccessIntakes(admin, user))) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold text-heading">Intakes</h1>
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-body">
            This workspace is for the Intake team and super-admins. If you should have access, ask a
            super-admin to set your department to <strong>Intake</strong> in Settings → Users.
          </CardContent>
        </Card>
      </div>
    )
  }

  const superAdmin = isSuperAdmin(user)
  const [{ data: clients }, { data: leads }] = await Promise.all([
    admin
      .from('clients')
      .select('id, firm_name, status, intake_mode')
      .neq('status', 'churned')
      .order('firm_name')
      .returns<ClientRow[]>(),
    admin.from('intake_leads').select('client_id, status, created_at').returns<LeadAgg[]>(),
  ])

  const all = clients ?? []
  const enabled = all.filter((c) => c.intake_mode !== 'none')
  const available = all.filter((c) => c.intake_mode === 'none')

  const agg = new Map<string, { total: number; retained: number; latest: string | null }>()
  for (const l of leads ?? []) {
    const a = agg.get(l.client_id) ?? { total: 0, retained: 0, latest: null }
    a.total++
    if (l.status === 'retained') a.retained++
    if (!a.latest || l.created_at > a.latest) a.latest = l.created_at
    agg.set(l.client_id, a)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Intakes</h1>
        <p className="mt-1 text-sm text-body">
          Record leads and calls for intake-service firms.{' '}
          <InfoTip text="'Intakes only' firms get an intake-only client portal (marketing pages hidden). 'Intakes + Leads' firms keep their full portal and gain an Intakes page." />
        </p>
      </div>

      {enabled.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-body-subtle">
            No firms on the intake service yet{superAdmin ? ' — add one below.' : '.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enabled.map((c) => {
            const a = agg.get(c.id) ?? { total: 0, retained: 0, latest: null }
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link href={`/admin/intakes/${c.id}`} className="hover:text-fg-brand hover:underline">
                        {c.firm_name}
                      </Link>
                    </CardTitle>
                    <Badge variant={c.intake_mode === 'intakes_only' ? 'warning' : 'brand'}>
                      {MODE_LABEL[c.intake_mode] ?? c.intake_mode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-body">Leads</dt>
                      <dd>{a.total}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-body">Retained</dt>
                      <dd className="text-emerald-600">{a.retained}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-body">Last lead</dt>
                      <dd>{a.latest ? a.latest.slice(0, 10) : '—'}</dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between pt-1">
                    <Link href={`/admin/intakes/${c.id}`} className="text-sm text-fg-brand hover:underline">
                      Open leads →
                    </Link>
                    {superAdmin && <IntakeModePicker clientId={c.id} current={c.intake_mode} compact />}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {superAdmin && available.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add a firm to the intake service</CardTitle>
          </CardHeader>
          <CardContent>
            <IntakeModePicker firms={available.map((c) => ({ id: c.id, name: c.firm_name }))} />
            <p className="mt-2 text-xs text-body-subtle">
              Choosing <strong>Intakes only</strong> hides the firm&apos;s marketing pages (Overview, SEO
              Plan, SEO Insights) — their portal becomes intake-only.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
