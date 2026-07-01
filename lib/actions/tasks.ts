'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff, isSuperAdmin } from '@/lib/auth/rbac'
import { getLeadScope, canManageDept } from '@/lib/auth/department'
import { ok, err, type Result } from '@/lib/errors'

export type CreateTaskInput = {
  title: string
  description?: string | null
  client_id?: string | null
  deliverable_id?: string | null
  department_id?: string | null
  assigned_to?: string | null
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  start_date?: string | null
  due_date?: string | null
  estimated_hours?: number | null
  tags?: string[] | null
}

// Role-aware deep link to a task (staff and super-admin live in separate portals).
async function taskLink(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  taskId: string
): Promise<string> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle<{ role: string | null }>()
  return data?.role === 'agency_staff' ? `/staff/tasks/${taskId}` : `/admin/tasks/${taskId}`
}

export async function createTask(input: CreateTaskInput): Promise<Result<{ id: string; task_number: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!input.title?.trim()) return err('VALIDATION_FAILED', 'Title is required.')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      title: input.title.trim(),
      description: input.description ?? null,
      client_id: input.client_id ?? null,
      deliverable_id: input.deliverable_id ?? null,
      department_id: input.department_id ?? null,
      assigned_to: input.assigned_to ?? null,
      priority: input.priority ?? 'medium',
      start_date: input.start_date ?? null,
      due_date: input.due_date ?? null,
      estimated_hours: input.estimated_hours ?? null,
      tags: input.tags ?? null,
      status: 'todo',
      created_by: user.id,
    })
    .select('id, task_number')
    .single()

  if (error || !data) {
    return err('INTERNAL', `Failed to create task: ${error?.message ?? 'unknown'}`)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'task',
    entity_id: data.id,
    action: 'created',
    after: { title: input.title, assigned_to: input.assigned_to ?? null },
  })

  // Notify assignee in-app if assigned
  if (input.assigned_to) {
    await admin.from('notifications').insert({
      user_id: input.assigned_to,
      type: 'task_assigned',
      subject: `New task: ${input.title}`,
      body: input.description ?? null,
      link: await taskLink(admin, input.assigned_to, data.id),
    })
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/admin/workload')
  if (input.client_id) revalidatePath(`/admin/clients/${input.client_id}/deliverables`)

  return ok({ id: data.id, task_number: data.task_number })
}

export async function updateTaskStatus(
  id: string,
  status: 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled',
  reason?: string | null
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('tasks')
    .select('status, department_id')
    .eq('id', id)
    .maybeSingle<{ status: string; department_id: string | null }>()

  // Submitting (moving a task to done) is the final approval. Staff take work
  // as far as "in review"; a super-admin submits it — OR the department lead
  // for the task's own department (they own their team's output).
  if (status === 'done' && !isSuperAdmin(user)) {
    const scope = await getLeadScope(admin, user.id)
    if (!canManageDept(scope, current?.department_id ?? null)) {
      return err('FORBIDDEN', 'Only a super-admin or the department lead can submit this task. Move it to In review instead.')
    }
  }

  // Reopening a completed/cancelled task is super-admin only — staff can't
  // quietly walk back a finished task.
  const wasClosed = current?.status === 'done' || current?.status === 'cancelled'
  const reopening = wasClosed && status !== 'done' && status !== 'cancelled'
  if (reopening && !isSuperAdmin(user)) {
    return err('FORBIDDEN', 'Only a super-admin can reopen a completed task.')
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    // Keep the paused reason only while paused; clear it otherwise.
    block_reason: status === 'blocked' ? (reason?.trim() || null) : null,
  }
  if (status === 'done' || status === 'cancelled') {
    updates.completed_at = new Date().toISOString()
  } else if (reopening) {
    updates.completed_at = null
  }

  const { error } = await admin.from('tasks').update(updates).eq('id', id)
  if (error) return err('INTERNAL', `Failed to update: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'task',
    entity_id: id,
    action: 'updated',
    after: { status },
  })

  revalidatePath('/admin/tasks')
  revalidatePath('/admin/workload')
  return ok({ id })
}

export async function reassignTask(
  id: string,
  assigneeUserId: string | null
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const { data: task } = await admin
    .from('tasks')
    .select('title')
    .eq('id', id)
    .maybeSingle()

  const { error } = await admin
    .from('tasks')
    .update({ assigned_to: assigneeUserId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err('INTERNAL', `Failed to reassign: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'task',
    entity_id: id,
    action: 'assigned',
    after: { assigned_to: assigneeUserId },
  })

  if (assigneeUserId && task) {
    await admin.from('notifications').insert({
      user_id: assigneeUserId,
      type: 'task_assigned',
      subject: `Task reassigned: ${task.title}`,
      link: await taskLink(admin, assigneeUserId, id),
    })
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/admin/workload')
  return ok({ id })
}

// --- Task detail: comments + hours ---

export async function addTaskComment(taskId: string, body: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!taskId) return err('VALIDATION_FAILED', 'Missing task id')
  const text = body?.trim()
  if (!text) return err('VALIDATION_FAILED', 'Comment cannot be empty')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('task_comments')
    .insert({ task_id: taskId, author_id: user.id, body: text })
    .select('id')
    .single()
  if (error || !data) return err('INTERNAL', `Failed to comment: ${error?.message ?? 'no row'}`)

  revalidatePath(`/admin/tasks/${taskId}`)
  revalidatePath(`/staff/tasks/${taskId}`)
  return ok({ id: data.id })
}

export async function setTaskHours(
  taskId: string,
  estimated: number | null,
  actual: number | null
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!taskId) return err('VALIDATION_FAILED', 'Missing task id')

  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({
      estimated_hours: estimated != null && Number.isFinite(estimated) ? estimated : null,
      actual_hours: actual != null && Number.isFinite(actual) ? actual : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
  if (error) return err('INTERNAL', `Failed to save hours: ${error.message}`)

  revalidatePath(`/admin/tasks/${taskId}`)
  revalidatePath(`/staff/tasks/${taskId}`)
  return ok({ id: taskId })
}

export async function deleteTask(id: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const { error } = await admin.from('tasks').delete().eq('id', id)
  if (error) return err('INTERNAL', `Failed to delete: ${error.message}`)

  revalidatePath('/admin/tasks')
  revalidatePath('/admin/workload')
  return ok({ id })
}
