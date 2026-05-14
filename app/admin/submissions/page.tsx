import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSubmissionKind } from '@/lib/submissions/kinds'
import { Plus, ExternalLink } from 'lucide-react'
import { ReplaceSubmissionRow } from './replace-submission-row'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  client_id: string
  firm_name: string | null
  kind: string
  title: string | null
  link_url: string
  notes: string | null
  status: 'pending_approval' | 'approved' | 'rejected'
  submitted_at: string
  submitted_by_name: string | null
  rejection_reason: string | null
}

export default async function SubmissionsPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/admin/submissions')
  if (!isAgencyStaff(user)) redirect('/login?error=forbidden')

  const admin = createAdminClient()
  const { data } = await admin
    .from('deliverable_submissions_with_actors')
    .select('id, client_id, firm_name, kind, title, link_url, notes, status, submitted_at, submitted_by_name, rejection_reason')
    .order('submitted_at', { ascending: false })
    .limit(100)
    .returns<Row[]>()

  const rows = data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Submissions</h1>
          <p className="mt-1 text-sm text-body">
            Staff-logged work. Auto-approved on submit — clients see it immediately.
          </p>
        </div>
        <Link href="/admin/submissions/new">
          <Button>
            <Plus className="h-4 w-4" />
            New submission
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent (last 100)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-body">No submissions yet.</p>
          ) : (
            <ul className="divide-y divide-border-light">
              {rows.map((r) => {
                const meta = getSubmissionKind(r.kind)
                const isReplaced = r.status === 'rejected' && r.rejection_reason === 'Replaced'
                const isActive = r.status === 'approved'
                return (
                  <li
                    key={r.id}
                    className={
                      isActive
                        ? 'grid grid-cols-12 items-center gap-3 px-6 py-4'
                        : 'grid grid-cols-12 items-center gap-3 px-6 py-4 opacity-60'
                    }
                  >
                    <div className="col-span-7">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-heading">
                          {r.title || meta?.label || r.kind}
                        </span>
                        <Badge variant="secondary">{meta?.label ?? r.kind}</Badge>
                        {isReplaced && <Badge variant="warning">Replaced</Badge>}
                        {r.status === 'rejected' && !isReplaced && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                        <a
                          href={r.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline"
                        >
                          link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-1 text-xs text-body">
                        {r.firm_name ?? '—'} · by {r.submitted_by_name ?? '—'}
                      </p>
                    </div>
                    <div className="col-span-3 text-xs text-body">
                      {new Date(r.submitted_at).toLocaleString()}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {isActive && (
                        <ReplaceSubmissionRow
                          submissionId={r.id}
                          currentLinkUrl={r.link_url}
                          currentTitle={r.title}
                          currentNotes={r.notes}
                        />
                      )}
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
