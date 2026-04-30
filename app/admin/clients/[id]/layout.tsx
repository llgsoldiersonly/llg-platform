import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { ClientTabNav } from './tab-nav'

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()
  const { data: client } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain, primary_contact_name, primary_contact_email, vertical, status, is_demo_only')
    .eq('id', id)
    .maybeSingle()

  if (!client) notFound()

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-600">Client</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{client.firm_name}</h1>
              {client.is_demo_only && <Badge variant="warning">DEMO</Badge>}
              <Badge variant="secondary">{client.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {[client.vertical, client.primary_contact_name, client.primary_domain]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Link
            href="/admin/clients"
            className="text-xs text-slate-600 hover:text-slate-700"
          >
            ← back to all clients
          </Link>
        </div>
        <div className="mt-6">
          <ClientTabNav clientId={id} />
        </div>
      </div>
      <div className="bg-slate-50">{children}</div>
    </div>
  )
}
