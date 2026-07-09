import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { getSubmissionKind } from '@/lib/submissions/kinds'
import { titleFromUrl } from '@/lib/title-from-url'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  kind: string
  title: string | null
  link_url: string
  status: 'pending_approval' | 'approved' | 'rejected'
  submitted_at: string
  rejection_reason: string | null
  firm_name: string | null
}

// "My Recent" — the agency-staff workspace's audit trail for THEIR own
// submissions. Scoped to submitted_by = current user. Distinct from
// /admin/submissions which is the cross-firm super-admin view.
export default async function StaffRecentPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  // Layout already gates access — if we got here, user is staff. But still
  // need their id for the filter.
  const userId = user!.id

  const admin = createAdminClient()
  const { data } = await admin
    .from('deliverable_submissions_with_actors')
    .select('id, kind, title, link_url, status, submitted_at, rejection_reason, firm_name')
    .eq('submitted_by', userId)
    .order('submitted_at', { ascending: false })
    .limit(50)
    .returns<Row[]>()
  const rows = data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">My recent submissions</h1>
        <p className="mt-1 text-sm text-body">
          The last 50 pieces of work you&apos;ve logged. Submit something new from{' '}
          <Link href="/staff" className="text-fg-brand hover:underline">
            Submit Work
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} submission{rows.length === 1 ? '' : 's'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-body">
              Nothing yet. Head to{' '}
              <Link href="/staff" className="text-fg-brand hover:underline">
                Submit Work
              </Link>{' '}
              to log your first piece.
            </p>
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
                    <div className="col-span-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-heading">
                          {r.title || titleFromUrl(r.link_url) || meta?.label || r.kind}
                        </span>
                        <Badge variant="secondary">{meta?.label ?? r.kind}</Badge>
                        {isReplaced && <Badge variant="warning">Replaced</Badge>}
                        <a
                          href={r.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline"
                        >
                          link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-1 text-xs text-body">{r.firm_name ?? '—'}</p>
                    </div>
                    <div className="col-span-4 text-xs text-body text-right">
                      {new Date(r.submitted_at).toLocaleString()}
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
