import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CredentialsForm } from './credentials-form'

export const dynamic = 'force-dynamic'

export default async function ClientCredentialsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: credentials }] = await Promise.all([
    supa.from('clients').select('id, firm_name').eq('id', id).maybeSingle(),
    supa.from('client_credentials').select('*').eq('client_id', id).maybeSingle(),
  ])

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API & integration credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-slate-600">
            All credentials are stored encrypted at rest. Sensitive fields (WordPress app password, etc.) are never sent to the browser after save — fields rendering blank below mean a value exists but is masked.
          </p>
          <CredentialsForm clientId={id} initial={credentials ?? {}} />
        </CardContent>
      </Card>
    </div>
  )
}
