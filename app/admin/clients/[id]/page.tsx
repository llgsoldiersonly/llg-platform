import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImpersonateCard } from '@/components/admin/impersonate-card'
import { InviteClientCard } from '@/components/admin/invite-client-card'
import { HardDeleteCard } from '@/components/admin/hard-delete-card'
import { ClientSitesCard, type ClientSite } from '@/components/admin/client-sites-card'
import { PullClientDataButton } from '@/components/admin/pull-client-data-button'

export const dynamic = 'force-dynamic'

type Subscription = {
  id: string
  status: string
  started_at: string
  package: { code: string; display_name: string; tier_order: number; monthly_fee_cents: number; color_hex: string | null } | null
  location: { id: string; label: string; city: string; state: string } | null
}

type Location = {
  id: string
  label: string
  city: string
  state: string
  is_primary: boolean
}

export default async function ClientSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ impersonation_error?: string; delete_error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supa = createAdminClient()

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const showImpersonate = isSuperAdmin(user)

  const [{ data: client }, subscriptionsRes, locationsRes, sitesRes] = await Promise.all([
    supa
      .from('clients')
      .select('id, firm_name, primary_domain, primary_contact_name, primary_contact_email, primary_contact_phone, vertical, status, onboarded_at, notes, is_demo_only')
      .eq('id', id)
      .maybeSingle(),
    supa
      .from('subscriptions')
      .select('id, status, started_at, package:package_templates(code, display_name, tier_order, monthly_fee_cents, color_hex), location:client_locations(id, label, city, state)')
      .eq('client_id', id)
      .returns<Subscription[]>(),
    supa
      .from('client_locations')
      .select('id, label, city, state, is_primary')
      .eq('client_id', id)
      .returns<Location[]>(),
    supa
      .from('client_sites')
      .select('id, domain, label, purpose, is_primary, is_active')
      .eq('client_id', id)
      .order('is_primary', { ascending: false })
      .order('domain', { ascending: true })
      .returns<ClientSite[]>(),
  ])

  if (!client) notFound()

  const subscriptions = subscriptionsRes.data ?? []
  const locations = locationsRes.data ?? []
  const sites = sitesRes.data ?? []
  const totalMrr = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.package?.monthly_fee_cents ?? 0), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-heading">Overview</h2>
        <PullClientDataButton clientId={client.id} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">
              {subscriptions.filter((s) => s.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">{locations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Estimated MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">
              ${(totalMrr / 100).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-body">Primary contact</p>
            <p className="text-heading">{client.primary_contact_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Email</p>
            <p className="text-heading">{client.primary_contact_email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Phone</p>
            <p className="text-heading">{client.primary_contact_phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Domain</p>
            <p className="text-heading">{client.primary_domain ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Vertical</p>
            <p className="text-heading">{client.vertical ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Onboarded</p>
            <p className="text-heading">{client.onboarded_at ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <ClientSitesCard clientId={client.id} sites={sites} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-body">No subscriptions yet.</p>
          ) : (
            <ul className="space-y-3">
              {subscriptions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border-light p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-heading">
                        {s.package?.display_name ?? 'Unknown package'}
                      </span>
                      <Badge variant="info">{s.package?.code ?? '—'}</Badge>
                      <Badge variant={s.status === 'active' ? 'success' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-body">
                      {s.location ? `${s.location.label} · ${s.location.city}, ${s.location.state}` : 'No location assigned'} · started {s.started_at}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-heading">
                      ${((s.package?.monthly_fee_cents ?? 0) / 100).toLocaleString()}
                    </p>
                    <p className="text-xs text-body">/ month</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <p className="text-sm text-body">No locations yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {locations.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-md border border-border-light p-3"
                >
                  <div>
                    <p className="font-medium text-heading">{l.label}</p>
                    <p className="text-xs text-body">{l.city}, {l.state}</p>
                  </div>
                  {l.is_primary && <Badge variant="outline">Primary</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InviteClientCard
        clientId={client.id}
        defaultEmail={client.primary_contact_email ?? null}
        defaultName={client.primary_contact_name ?? null}
      />

      {showImpersonate && (
        <ImpersonateCard
          clientId={client.id}
          clientName={client.firm_name}
          errorMessage={sp.impersonation_error}
        />
      )}

      {showImpersonate && (
        <HardDeleteCard
          clientId={client.id}
          clientName={client.firm_name}
          errorMessage={sp.delete_error}
        />
      )}
    </div>
  )
}
