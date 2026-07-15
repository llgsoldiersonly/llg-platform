import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { canAccessIntakes } from '@/lib/actions/intakes'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft } from 'lucide-react'
import { NewIntakeLeadForm } from './new-lead-form'
import { IntakeLeadCard, type IntakeLead, type IntakeFile } from './lead-card'

export const dynamic = 'force-dynamic'

export default async function ClientIntakesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/intakes')

  const admin = createAdminClient()
  if (!(await canAccessIntakes(admin, user))) redirect('/admin/intakes')

  const { data: client } = await admin
    .from('clients')
    .select('id, firm_name, intake_mode')
    .eq('id', clientId)
    .maybeSingle<{ id: string; firm_name: string; intake_mode: string }>()
  if (!client || client.intake_mode === 'none') notFound()

  const { data: leads } = await admin
    .from('intake_leads')
    .select('id, lead_name, lead_phone, date_of_loss, at_fault_name, at_fault_phone, at_fault_license, at_fault_insurance, description, status, client_decision, client_decision_at, created_by, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .returns<IntakeLead[]>()

  const leadIds = (leads ?? []).map((l) => l.id)
  const { data: files } = leadIds.length
    ? await admin
        .from('intake_lead_files')
        .select('id, lead_id, kind, file_name, size_bytes, created_at')
        .in('lead_id', leadIds)
        .order('created_at')
        .returns<IntakeFile[]>()
    : { data: [] as IntakeFile[] }

  const creatorIds = [...new Set((leads ?? []).map((l) => l.created_by).filter(Boolean))] as string[]
  const { data: creators } = creatorIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', creatorIds).returns<{ id: string; full_name: string | null }[]>()
    : { data: [] as { id: string; full_name: string | null }[] }
  const creatorName = new Map((creators ?? []).map((p) => [p.id, p.full_name ?? 'Unknown']))

  const filesByLead = new Map<string, IntakeFile[]>()
  for (const f of files ?? []) {
    const list = filesByLead.get(f.lead_id) ?? []
    list.push(f)
    filesByLead.set(f.lead_id, list)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Link href="/admin/intakes" className="inline-flex items-center gap-1 text-sm text-body-subtle hover:text-body">
        <ChevronLeft className="h-4 w-4" /> All intake firms
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-heading">{client.firm_name} — intakes</h1>
        <p className="mt-1 text-sm text-body">
          {(leads ?? []).length} lead{(leads ?? []).length === 1 ? '' : 's'} ·{' '}
          {(leads ?? []).filter((l) => l.status === 'retained').length} retained
        </p>
      </div>

      <NewIntakeLeadForm clientId={clientId} />

      {(leads ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-body-subtle">
            No leads yet — add the first one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(leads ?? []).map((lead) => (
            <IntakeLeadCard
              key={lead.id}
              lead={lead}
              files={filesByLead.get(lead.id) ?? []}
              createdByName={lead.created_by ? creatorName.get(lead.created_by) ?? null : null}
              canDelete={isSuperAdmin(user)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
