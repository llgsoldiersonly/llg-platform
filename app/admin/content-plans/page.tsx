import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlanCreateForm } from './plan-create-form'

export const dynamic = 'force-dynamic'

type PlanRow = {
  id: string
  name: string
  kind: string
  client_id: string
  created_at: string
}

const KIND_LABEL: Record<string, string> = {
  blog: 'Blog',
  seo_page: 'SEO pages',
  sitemap: 'Sitemap',
}

export default async function ContentPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAgencyStaff(user)) redirect('/admin/dashboard')

  const supa = createAdminClient()
  const [{ data: plans }, { data: clients }, { data: departments }, { data: counts }] =
    await Promise.all([
      supa
        .from('content_plans')
        .select('id, name, kind, client_id, created_at')
        .order('created_at', { ascending: false })
        .returns<PlanRow[]>(),
      supa.from('clients').select('id, firm_name').neq('status', 'churned').order('firm_name')
        .returns<{ id: string; firm_name: string }[]>(),
      supa.from('departments').select('id, name').order('name')
        .returns<{ id: string; name: string }[]>(),
      supa.from('content_plan_items').select('plan_id, status')
        .returns<{ plan_id: string; status: string }[]>(),
    ])

  const firmById = new Map((clients ?? []).map((c) => [c.id, c.firm_name]))
  const progress = new Map<string, { total: number; done: number }>()
  for (const c of counts ?? []) {
    const p = progress.get(c.plan_id) ?? { total: 0, done: 0 }
    p.total++
    if (c.status === 'done') p.done++
    progress.set(c.plan_id, p)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Content plans</h1>
        <p className="mt-1 text-sm text-body">
          Plan bulk content (blogs, SEO pages, a sitemap) as a list, then split the rows across
          staff. Each assigned row becomes a task on that person&apos;s board.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New plan</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanCreateForm clients={clients ?? []} departments={departments ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All plans ({plans?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(plans ?? []).length === 0 ? (
            <p className="p-6 text-sm text-body">No plans yet. Create one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Plan</th>
                  <th className="px-6 py-3 text-left font-medium">Client</th>
                  <th className="px-6 py-3 text-left font-medium">Type</th>
                  <th className="px-6 py-3 text-left font-medium">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {(plans ?? []).map((p) => {
                  const prog = progress.get(p.id) ?? { total: 0, done: 0 }
                  return (
                    <tr key={p.id}>
                      <td className="px-6 py-3">
                        <Link
                          href={`/admin/content-plans/${p.id}`}
                          className="font-medium text-heading hover:text-fg-brand hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-body">{firmById.get(p.client_id) ?? '—'}</td>
                      <td className="px-6 py-3">
                        <Badge variant="secondary">{KIND_LABEL[p.kind] ?? p.kind}</Badge>
                      </td>
                      <td className="px-6 py-3 text-body">
                        {prog.done}/{prog.total} done
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
