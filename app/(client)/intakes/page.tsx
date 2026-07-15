import { redirect } from 'next/navigation'
import { getClientContext } from '@/lib/client-context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { LeadDecisionButtons } from './decision-buttons'

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  lead_name: string
  lead_phone: string | null
  date_of_loss: string | null
  description: string | null
  status: string
  client_decision: string | null
  client_decision_at: string | null
  created_at: string
}
type LeadFile = { id: string; lead_id: string; kind: string; file_name: string }

const STATUS_BADGE: Record<string, 'info' | 'success' | 'warning' | 'secondary'> = {
  new: 'info',
  retained: 'success',
  referred_out: 'warning',
  dropped: 'secondary',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  retained: 'Retained',
  referred_out: 'Referred out',
  dropped: 'Dropped',
}

export default async function ClientIntakesPage() {
  const ctx = await getClientContext()
  if (!ctx) redirect('/login')
  if (ctx.client.intake_mode === 'none') redirect('/overview')

  // The user's own client (RLS scopes both queries to their firm).
  const supabase = await createClient()
  const [{ data: leads }, { data: files }] = await Promise.all([
    supabase
      .from('intake_leads')
      .select('id, lead_name, lead_phone, date_of_loss, description, status, client_decision, client_decision_at, created_at')
      .eq('client_id', ctx.client.id)
      .order('created_at', { ascending: false })
      .returns<Lead[]>(),
    supabase
      .from('intake_lead_files')
      .select('id, lead_id, kind, file_name')
      .returns<LeadFile[]>(),
  ])

  const filesByLead = new Map<string, LeadFile[]>()
  for (const f of files ?? []) {
    const list = filesByLead.get(f.lead_id) ?? []
    list.push(f)
    filesByLead.set(f.lead_id, list)
  }

  const list = leads ?? []
  const retained = list.filter((l) => l.status === 'retained').length

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl text-heading">Intakes for {ctx.client.firm_name}</h1>
        <p className="mt-1 text-sm text-body">
          {list.length} lead{list.length === 1 ? '' : 's'} recorded · {retained} retained. Our intake
          team adds each qualified call here with the signed retainer and supporting documents.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-body">
            No leads yet — as soon as our intake team qualifies a call for your firm, it appears here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((lead) => {
            const lf = filesByLead.get(lead.id) ?? []
            const retainer = lf.find((f) => f.kind === 'retainer')
            const support = lf.filter((f) => f.kind === 'support')
            return (
              <Card key={lead.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {lead.lead_name}
                      {lead.lead_phone && (
                        <span className="ml-2 text-sm font-normal text-body">{lead.lead_phone}</span>
                      )}
                    </CardTitle>
                    <Badge variant={STATUS_BADGE[lead.status] ?? 'secondary'}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-body-subtle">
                    {lead.date_of_loss ? `Date of loss ${lead.date_of_loss}` : ''}
                    {lead.date_of_loss ? ' · ' : ''}received {lead.created_at.slice(0, 10)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lead.description && (
                    <p className="whitespace-pre-wrap text-sm text-body">{lead.description}</p>
                  )}
                  {(retainer || support.length > 0) && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {retainer && (
                        <a
                          href={`/api/intake-files/${retainer.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-fg-brand hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Signed retainer
                        </a>
                      )}
                      {support.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/intake-files/${f.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-fg-brand hover:underline"
                        >
                          {f.file_name.toLowerCase().endsWith('.pdf') ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          {f.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                  <LeadDecisionButtons
                    leadId={lead.id}
                    current={lead.client_decision}
                    decidedAt={lead.client_decision_at}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
