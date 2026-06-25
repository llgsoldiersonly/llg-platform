import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LeadsManager, type LeadFile } from './leads-manager'

export const dynamic = 'force-dynamic'

export default async function ClientLeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: files }] = await Promise.all([
    supa.from('clients').select('id, firm_name, leads_enabled').eq('id', id).maybeSingle(),
    supa
      .from('client_lead_files')
      .select('id, file_name, size_bytes, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .returns<LeadFile[]>(),
  ])

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h2 className="text-lg font-semibold text-heading">Leads</h2>
        <p className="mt-1 text-sm text-body">
          Upload lead PDFs for {client.firm_name}. When the box is on, the client can download them
          from their portal (above Monthly production).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsManager
            clientId={client.id}
            enabled={!!client.leads_enabled}
            files={files ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
