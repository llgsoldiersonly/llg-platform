'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

type PlanKind = 'blog' | 'seo_page' | 'sitemap'

export type PlanRowInput = {
  keyword: string
  practice_area?: string | null
  tier?: string | null
  target_slug?: string | null
}

export type CreateContentPlanInput = {
  client_id: string
  name: string
  kind: PlanKind
  department_id?: string | null
  rows: PlanRowInput[]
}

function isPlanKind(v: string): v is PlanKind {
  return v === 'blog' || v === 'seo_page' || v === 'sitemap'
}

// Role-aware deep link to a task (staff vs super-admin live in separate portals).
async function taskLinkFor(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  taskId: string
): Promise<string> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle<{ role: string }>()
  return data?.role === 'agency_staff' ? `/staff/tasks/${taskId}` : `/admin/tasks/${taskId}`
}

// Create a plan and its rows in one shot (the paste/import path).
export async function createContentPlan(
  input: CreateContentPlanInput
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!input.client_id) return err('VALIDATION_FAILED', 'Pick a client.')
  if (!input.name?.trim()) return err('VALIDATION_FAILED', 'Give the plan a name.')
  if (!isPlanKind(input.kind)) return err('VALIDATION_FAILED', 'Unknown plan type.')

  const rows = (input.rows ?? [])
    .map((r) => ({
      keyword: r.keyword?.trim() ?? '',
      practice_area: r.practice_area?.trim() || null,
      tier: r.tier?.trim() || null,
      target_slug: r.target_slug?.trim() || null,
    }))
    .filter((r) => r.keyword.length > 0)
  if (rows.length === 0) return err('VALIDATION_FAILED', 'Add at least one row (keyword required).')
  if (rows.length > 1000) return err('VALIDATION_FAILED', 'Plans are limited to 1000 rows at a time.')

  const admin = createAdminClient()
  const { data: plan, error: planErr } = await admin
    .from('content_plans')
    .insert({
      client_id: input.client_id,
      name: input.name.trim(),
      kind: input.kind,
      department_id: input.department_id || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (planErr || !plan) return err('INTERNAL', `Failed to create plan: ${planErr?.message ?? 'unknown'}`)

  const itemRows = rows.map((r, i) => ({ plan_id: plan.id, position: i, ...r }))
  const { error: itemsErr } = await admin.from('content_plan_items').insert(itemRows)
  if (itemsErr) return err('INTERNAL', `Plan created but rows failed: ${itemsErr.message}`)

  revalidatePath('/admin/content-plans')
  return ok({ id: plan.id })
}

// Assign a set of plan items to one staffer (or unassign with null). Each
// assigned item gets a child task (created if it doesn't exist yet, reassigned
// if it does) so the work shows on the assignee's board / My Day. This is the
// "split pages between staff" action.
export async function assignPlanItems(
  itemIds: string[],
  userId: string | null
): Promise<Result<{ assigned: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!itemIds?.length) return err('VALIDATION_FAILED', 'Pick at least one row.')

  const admin = createAdminClient()

  const { data: items } = await admin
    .from('content_plan_items')
    .select('id, plan_id, keyword, target_slug, task_id')
    .in('id', itemIds)
    .returns<{ id: string; plan_id: string; keyword: string; target_slug: string | null; task_id: string | null }[]>()
  if (!items?.length) return err('NOT_FOUND', 'Rows not found.')

  // All items should belong to the same plan for a split action; look the plan
  // up once for client/department/name context.
  const planId = items[0].plan_id
  const { data: plan } = await admin
    .from('content_plans')
    .select('id, name, kind, client_id, department_id')
    .eq('id', planId)
    .maybeSingle<{ id: string; name: string; kind: string; client_id: string; department_id: string | null }>()
  if (!plan) return err('NOT_FOUND', 'Plan not found.')

  let assigned = 0
  for (const item of items) {
    let taskId = item.task_id

    if (taskId) {
      // Reassign the existing child task.
      await admin
        .from('tasks')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .eq('id', taskId)
    } else if (userId) {
      // Spawn a child task for this row.
      const { data: task } = await admin
        .from('tasks')
        .insert({
          title: item.keyword,
          description: `Content plan: ${plan.name}${item.target_slug ? ` · ${item.target_slug}` : ''}`,
          client_id: plan.client_id,
          department_id: plan.department_id,
          assigned_to: userId,
          priority: 'medium',
          status: 'todo',
          created_by: user.id,
          tags: ['content-plan', plan.kind],
        })
        .select('id')
        .single<{ id: string }>()
      taskId = task?.id ?? null
    }

    await admin
      .from('content_plan_items')
      .update({ assigned_to: userId, task_id: taskId, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (userId && taskId) {
      await admin.from('notifications').insert({
        user_id: userId,
        type: 'task_assigned',
        subject: `Content: ${item.keyword}`,
        body: `From plan "${plan.name}".`,
        link: await taskLinkFor(admin, userId, taskId),
      })
    }
    assigned++
  }

  revalidatePath('/admin/content-plans')
  revalidatePath(`/admin/content-plans/${planId}`)
  return ok({ assigned })
}

// Round-robin every currently-unassigned row across a set of staffers.
export async function distributePlanItems(
  planId: string,
  userIds: string[]
): Promise<Result<{ assigned: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!planId) return err('VALIDATION_FAILED', 'Missing plan.')
  if (!userIds?.length) return err('VALIDATION_FAILED', 'Pick at least one person to distribute to.')

  const admin = createAdminClient()
  const { data: items } = await admin
    .from('content_plan_items')
    .select('id')
    .eq('plan_id', planId)
    .is('assigned_to', null)
    .order('position')
    .returns<{ id: string }[]>()
  if (!items?.length) return err('VALIDATION_FAILED', 'No unassigned rows to distribute.')

  let assigned = 0
  for (let i = 0; i < items.length; i++) {
    const userId = userIds[i % userIds.length]
    const res = await assignPlanItems([items[i].id], userId)
    if (res.ok) assigned += res.data.assigned
  }

  revalidatePath(`/admin/content-plans/${planId}`)
  return ok({ assigned })
}

export async function deleteContentPlan(planId: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!planId) return err('VALIDATION_FAILED', 'Missing plan.')

  const admin = createAdminClient()
  // Deleting the plan cascades to its rows; the spawned child tasks are left
  // intact (they may be in flight) and simply lose their plan linkage.
  const { error } = await admin.from('content_plans').delete().eq('id', planId)
  if (error) return err('INTERNAL', `Failed to delete plan: ${error.message}`)

  revalidatePath('/admin/content-plans')
  return ok({ id: planId })
}
