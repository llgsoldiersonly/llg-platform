import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { titleFromUrl } from '@/lib/title-from-url'

export const dynamic = 'force-dynamic'

type TaskHit = {
  id: string
  task_number: number
  title: string
  status: string
  due_date: string | null
  client: { firm_name: string } | null
}
type SubmissionHit = {
  id: string
  kind: string
  title: string | null
  link_url: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do', in_progress: 'In progress', in_review: 'In review',
  blocked: 'Paused', done: 'Submitted', cancelled: 'Cancelled',
}

// Escape ILIKE wildcards so a user typing "%" doesn't match everything.
function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
}

export default async function StaffSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login?next=/staff/search')

  let tasks: TaskHit[] = []
  let submissions: SubmissionHit[] = []

  if (query.length >= 2) {
    const admin = createAdminClient()
    const pattern = likePattern(query)

    // Firms whose name matches — lets "kohm" find every Kohm task.
    const { data: firms } = await admin
      .from('clients')
      .select('id')
      .ilike('firm_name', pattern)
      .returns<{ id: string }[]>()
    const firmIds = (firms ?? []).map((f) => f.id)

    const [byTitle, byFirm, { data: subs }] = await Promise.all([
      admin
        .from('tasks')
        .select('id, task_number, title, status, due_date, client:clients(firm_name)')
        .eq('assigned_to', user.id)
        .ilike('title', pattern)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<TaskHit[]>(),
      firmIds.length > 0
        ? admin
            .from('tasks')
            .select('id, task_number, title, status, due_date, client:clients(firm_name)')
            .eq('assigned_to', user.id)
            .in('client_id', firmIds)
            .order('created_at', { ascending: false })
            .limit(50)
            .returns<TaskHit[]>()
        : Promise.resolve({ data: [] as TaskHit[] }),
      admin
        .from('deliverable_submissions')
        .select('id, kind, title, link_url, created_at')
        .eq('submitted_by', user.id)
        .or(`title.ilike.${pattern},link_url.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(25)
        .returns<SubmissionHit[]>(),
    ])

    const seen = new Set<string>()
    tasks = [...(byTitle.data ?? []), ...(byFirm.data ?? [])].filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    submissions = subs ?? []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Search your work</h1>
        <p className="mt-1 text-sm text-body">
          Tasks assigned to you (including completed) and everything you&apos;ve submitted.
        </p>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Task title or firm name… e.g. kohm blog"
          autoFocus
          className="w-full max-w-md rounded-md border border-border-default bg-bg-default px-3 py-2 text-sm text-heading"
        />
        <button
          type="submit"
          className="rounded-md bg-dark px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-body-subtle">Type at least 2 characters.</p>
      )}

      {query.length >= 2 && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your tasks ({tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-body-subtle">No matching tasks.</p>
              ) : (
                tasks.map((t) => {
                  const closed = t.status === 'done' || t.status === 'cancelled'
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border-default p-2.5">
                      <div className="min-w-0">
                        <Link
                          href={`/staff/tasks/${t.id}`}
                          className={`text-sm font-medium hover:text-fg-brand hover:underline ${closed ? 'text-body-subtle line-through' : 'text-heading'}`}
                        >
                          {t.title}
                        </Link>
                        <p className="text-xs text-body-subtle">
                          #{t.task_number} · {t.client?.firm_name ?? 'internal'}
                          {t.due_date && ` · due ${t.due_date}`}
                        </p>
                      </div>
                      <Badge variant={closed ? 'secondary' : 'info'}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your submissions ({submissions.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {submissions.length === 0 ? (
                <p className="text-sm text-body-subtle">No matching submissions.</p>
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="rounded border border-border-default p-2.5">
                    {s.link_url ? (
                      <a href={s.link_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-fg-brand hover:underline">
                        {s.title || titleFromUrl(s.link_url) || s.link_url}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-heading">{s.title ?? s.kind}</span>
                    )}
                    <p className="text-xs text-body-subtle">{s.kind} · {s.created_at.slice(0, 10)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
