import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff, canApproveSubmissions } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSubmissionKind } from '@/lib/submissions/kinds'
import { ApprovalActions } from './approval-actions'
import { ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  client_id: string
  firm_name: string | null
  kind: string
  title: string | null
  link_url: string
  notes: string | null
  submitted_at: string
  submitted_by_name: string | null
}

export default async function ApprovalQueuePage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/submissions/approvals')
  if (!isAgencyStaff(user)) redirect('/login?error=forbidden')

  const isApprover = canApproveSubmissions(user)

  const admin = createAdminClient()
  const { data } = await admin
    .from('deliverable_submissions_with_actors')
    .select('id, client_id, firm_name, kind, title, link_url, notes, submitted_at, submitted_by_name')
    .eq('status', 'pending_approval')
    .order('submitted_at', { ascending: true })
    .returns<Row[]>()

  const rows = data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Approval queue</h1>
        <p className="mt-1 text-sm text-body">
          {isApprover
            ? `${rows.length} submission${rows.length === 1 ? '' : 's'} waiting on you.`
            : 'You can see what is pending, but only super admins can approve or reject.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-body">Nothing pending. Inbox zero.</p>
          ) : (
            <ul className="divide-y divide-border-light">
              {rows.map((r) => {
                const meta = getSubmissionKind(r.kind)
                return (
                  <li key={r.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-heading">
                            {r.title || meta?.label || r.kind}
                          </span>
                          <Badge variant="secondary">{meta?.label ?? r.kind}</Badge>
                          <a
                            href={r.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-fg-brand hover:underline"
                          >
                            open link <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <p className="mt-1 text-xs text-body">
                          {r.firm_name ?? '—'} · by {r.submitted_by_name ?? '—'} ·{' '}
                          {new Date(r.submitted_at).toLocaleString()}
                        </p>
                        {r.notes && (
                          <p className="mt-2 rounded-md bg-neutral-secondary-soft p-2 text-xs text-body">
                            {r.notes}
                          </p>
                        )}
                      </div>
                      {isApprover && <ApprovalActions submissionId={r.id} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
