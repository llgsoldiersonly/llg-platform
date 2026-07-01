import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { Badge } from '@/components/ui/badge'
import { PlanItemsManager, type PlanItem } from './plan-items-manager'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  blog: 'Blog',
  seo_page: 'SEO pages',
  sitemap: 'Sitemap',
}

export default async function ContentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAgencyStaff(user)) redirect('/admin/dashboard')

  const supa = createAdminClient()
  const { data: plan } = await supa
    .from('content_plans')
    .select('id, name, kind, client_id, department_id')
    .eq('id', id)
    .maybeSingle<{ id: string; name: string; kind: string; client_id: string; department_id: string | null }>()
  if (!plan) notFound()

  const [{ data: client }, { data: rawItems }, { data: staff }] = await Promise.all([
    supa.from('clients').select('firm_name').eq('id', plan.client_id).maybeSingle<{ firm_name: string }>(),
    supa
      .from('content_plan_items')
      .select('id, keyword, practice_area, tier, target_slug, status, assigned_to')
      .eq('plan_id', id)
      .order('position')
      .returns<Omit<PlanItem, 'assigneeName'>[]>(),
    supa
      .from('profiles')
      .select('id, full_name, department_id, is_active, role')
      .in('role', ['agency_staff', 'super_admin'])
      .returns<{ id: string; full_name: string | null; department_id: string | null; is_active: boolean; role: string }[]>(),
  ])

  const nameById = new Map((staff ?? []).map((p) => [p.id, p.full_name]))
  const items: PlanItem[] = (rawItems ?? []).map((it) => ({
    ...it,
    assigneeName: it.assigned_to ? nameById.get(it.assigned_to) ?? null : null,
  }))

  // Assignment targets: active staff, scoped to the plan's department if set.
  const assignableStaff = (staff ?? [])
    .filter((p) => p.is_active && (!plan.department_id || p.department_id === plan.department_id))
    .map((p) => ({ id: p.id, name: p.full_name ?? 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const assignedCount = items.filter((i) => i.assigned_to).length

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <Link href="/admin/content-plans" className="text-sm text-fg-brand hover:underline">
          ← All content plans
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-heading">{plan.name}</h1>
          <Badge variant="secondary">{KIND_LABEL[plan.kind] ?? plan.kind}</Badge>
        </div>
        <p className="mt-1 text-sm text-body">
          {client?.firm_name ?? 'Client'} · {total} rows · {assignedCount} assigned · {done} done
        </p>
        <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-neutral-secondary-soft">
          <div
            className="h-full rounded-full bg-fg-brand transition-all"
            style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <PlanItemsManager planId={plan.id} items={items} staff={assignableStaff} />
    </div>
  )
}
