import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

type ClientRow = {
  id: string
  firm_name: string
  primary_domain: string | null
  primary_contact_name: string | null
  vertical: string | null
  status: string
  is_demo_only: boolean
  onboarded_at: string | null
  subscriptions: { id: string; status: string; package: { code: string; display_name: string; color_hex: string | null } | null }[]
  locations: { id: string }[]
}

const statusVariant: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  active: 'success',
  onboarding: 'warning',
  paused: 'secondary',
  prospect: 'secondary',
  churned: 'destructive',
}

export default async function ClientsListPage() {
  const supa = createAdminClient()
  const { data: clients, error } = await supa
    .from('clients')
    .select(`
      id, firm_name, primary_domain, primary_contact_name, vertical, status, is_demo_only, onboarded_at,
      subscriptions ( id, status, package:package_templates ( code, display_name, color_hex ) ),
      locations:client_locations ( id )
    `)
    .order('is_demo_only', { ascending: true })
    .order('firm_name', { ascending: true })
    .returns<ClientRow[]>()

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6 text-sm text-fg-danger">
            Failed to load clients: {error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">Clients</h1>
        <p className="mt-1 text-sm text-body">
          {clients?.length ?? 0} total — click a row to drill in
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Firm</th>
                <th className="px-6 py-3 text-left font-medium">Vertical</th>
                <th className="px-6 py-3 text-left font-medium">Packages</th>
                <th className="px-6 py-3 text-left font-medium">Locations</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {clients?.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-secondary-soft">
                  <td className="px-6 py-4">
                    <Link href={`/admin/clients/${c.id}`} className="block">
                      <div className="flex items-center gap-2 font-medium text-heading">
                        {c.firm_name}
                        {c.is_demo_only && <Badge variant="warning">DEMO</Badge>}
                      </div>
                      {c.primary_contact_name && (
                        <p className="text-xs text-body">{c.primary_contact_name}</p>
                      )}
                      {c.primary_domain && (
                        <p className="text-xs text-body-subtle">{c.primary_domain}</p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-body">{c.vertical ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {c.subscriptions.map((s) => (
                        <Badge key={s.id} variant="info">
                          {s.package?.code ?? 'unknown'}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-body">{c.locations.length}</td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant[c.status] ?? 'secondary'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-body-subtle hover:text-body"
                      aria-label={`View ${c.firm_name}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
