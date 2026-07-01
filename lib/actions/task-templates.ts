'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { applyTemplateWithAdmin } from '@/lib/tasks/apply-template'
import { ok, err, type Result } from '@/lib/errors'

export async function createTaskTemplate(
  name: string,
  kind: string,
  steps: string[]
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!name?.trim()) return err('VALIDATION_FAILED', 'Template needs a name')

  const cleanSteps = (steps ?? []).map((s) => s.trim()).filter(Boolean)
  if (cleanSteps.length === 0) return err('VALIDATION_FAILED', 'Add at least one step')

  const admin = createAdminClient()
  const { data: tpl, error } = await admin
    .from('task_templates')
    .insert({ name: name.trim(), kind: kind || 'generic', created_by: user.id })
    .select('id')
    .single<{ id: string }>()
  if (error || !tpl) return err('INTERNAL', `Failed to create template: ${error?.message ?? 'name already used?'}`)

  const rows = cleanSteps.map((title, i) => ({ template_id: tpl.id, position: i + 1, title }))
  const { error: stepErr } = await admin.from('task_template_steps').insert(rows)
  if (stepErr) return err('INTERNAL', `Template created but steps failed: ${stepErr.message}`)

  revalidatePath('/admin/settings/task-templates')
  return ok({ id: tpl.id })
}

export async function deleteTaskTemplate(templateId: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!templateId) return err('VALIDATION_FAILED', 'Missing template')

  const admin = createAdminClient()
  const { error } = await admin.from('task_templates').delete().eq('id', templateId)
  if (error) return err('INTERNAL', `Failed to delete: ${error.message}`)

  revalidatePath('/admin/settings/task-templates')
  return ok({ id: templateId })
}

// Apply a template to a task: create one subtask per step. Safe to call more
// than once — it appends, so callers that only want it applied once should
// check for existing subtasks first (the task-detail UI does).
export async function applyTemplateToTask(
  taskId: string,
  templateId: string
): Promise<Result<{ created: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')
  if (!taskId || !templateId) return err('VALIDATION_FAILED', 'Missing task or template')

  const admin = createAdminClient()
  const created = await applyTemplateWithAdmin(admin, taskId, templateId, user.id)
  if (created < 0) return err('INTERNAL', 'Failed to apply template')

  revalidatePath(`/admin/tasks/${taskId}`)
  revalidatePath(`/staff/tasks/${taskId}`)
  return ok({ created })
}
