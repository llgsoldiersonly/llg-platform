import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AssetsManager, type ClientAsset, type TaskOption } from './assets-manager'

export const dynamic = 'force-dynamic'

export default async function ClientAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: assets }, { data: tasks }] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa
      .from('client_assets')
      .select('id, file_name, size_bytes, created_at, task_id')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .returns<ClientAsset[]>(),
    supa
      .from('tasks')
      .select('id, task_number, title')
      .eq('client_id', id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .returns<TaskOption[]>(),
  ])

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h2 className="text-lg font-semibold text-heading">Assets</h2>
        <p className="mt-1 text-sm text-body">
          Internal working files for {client.firm_name} — one folder per client so nothing gets
          mixed up. Staff only; never shown to the client. Optionally attach a file to a task.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset folder</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetsManager clientId={client.id} assets={assets ?? []} tasks={tasks ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
