'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

export type CustomDeliverableInput = {
  client_id: string
  subscription_id: string
  custom_title: string
  custom_description: string | null
  custom_department_slug: string
  custom_frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'ongoing'
  custom_target_count: number
  custom_target_unit: string | null
  is_incentive: boolean
  period_start: string
  period_end: string
  notes: string | null
}

export async function addCustomDeliverable(input: CustomDeliverableInput): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!input.custom_title?.trim()) {
    return err('VALIDATION_FAILED', 'Title is required.')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('deliverables')
    .insert({
      subscription_id: input.subscription_id,
      template_id: null,
      custom_title: input.custom_title.trim(),
      custom_description: input.custom_description,
      custom_department_slug: input.custom_department_slug,
      custom_frequency: input.custom_frequency,
      custom_target_count: input.custom_target_count,
      custom_target_unit: input.custom_target_unit,
      source: input.is_incentive ? 'incentive' : 'custom',
      is_incentive: input.is_incentive,
      period_start: input.period_start,
      period_end: input.period_end,
      status: 'pending',
      notes: input.notes,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return err('INTERNAL', `Failed to add deliverable: ${error.message}`, error)
  }

  revalidatePath(`/admin/clients/${input.client_id}/deliverables`)
  return ok({ id: data.id })
}

export async function updateDeliverableStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'done' | 'skipped' | 'blocked',
  clientId: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'done') {
    updates.completed_at = new Date().toISOString()
    updates.completed_by = user.id
  }

  const { error } = await admin.from('deliverables').update(updates).eq('id', id)

  if (error) {
    return err('INTERNAL', `Failed to update: ${error.message}`, error)
  }

  revalidatePath(`/admin/clients/${clientId}/deliverables`)
  return ok({ id })
}

export async function deleteCustomDeliverable(
  id: string,
  clientId: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const admin = createAdminClient()
  // Only allow deletion of custom/incentive rows — package rows must be untouchable
  const { data: existing } = await admin
    .from('deliverables')
    .select('source, template_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return err('NOT_FOUND')
  if (existing.template_id !== null) {
    return err('FORBIDDEN', 'Package deliverables cannot be deleted, only marked done/skipped.')
  }

  const { error } = await admin.from('deliverables').delete().eq('id', id)
  if (error) {
    return err('INTERNAL', `Failed to delete: ${error.message}`, error)
  }

  revalidatePath(`/admin/clients/${clientId}/deliverables`)
  return ok({ id })
}
