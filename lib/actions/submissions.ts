'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff, canApproveSubmissions } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import { isValidSubmissionKind, type SubmissionKind } from '@/lib/submissions/kinds'

export type SubmitDeliverableInput = {
  client_id: string
  kind: SubmissionKind
  link_url: string
  title?: string | null
  notes?: string | null
  deliverable_id?: string | null
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function submitDeliverable(
  input: SubmitDeliverableInput
): Promise<Result<{ id: string; auto_approved: boolean }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!isValidSubmissionKind(input.kind)) {
    return err('VALIDATION_FAILED', 'Unknown submission kind.')
  }
  if (!input.link_url?.trim() || !isValidUrl(input.link_url.trim())) {
    return err('VALIDATION_FAILED', 'A valid link (https://…) is required.')
  }
  if (!input.client_id) {
    return err('VALIDATION_FAILED', 'Pick a firm.')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('deliverable_submissions')
    .insert({
      client_id: input.client_id,
      kind: input.kind,
      link_url: input.link_url.trim(),
      title: input.title?.trim() || null,
      notes: input.notes?.trim() || null,
      deliverable_id: input.deliverable_id || null,
      submitted_by: user.id,
    })
    .select('id, status')
    .single()

  if (error || !data) {
    return err('INTERNAL', `Failed to submit: ${error?.message ?? 'unknown error'}`, error)
  }

  // social_post auto-approves via trigger — if so, bump the counter immediately.
  const auto_approved = data.status === 'approved'
  if (auto_approved && input.deliverable_id) {
    await incrementDeliverableCount(admin, input.deliverable_id)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: data.id,
    action: auto_approved ? 'auto_approved' : 'submitted',
    after: { kind: input.kind, client_id: input.client_id, link_url: input.link_url, auto_approved },
  })

  revalidatePath('/admin/submissions')
  revalidatePath('/admin/submissions/approvals')
  revalidatePath(`/admin/clients/${input.client_id}`)

  return ok({ id: data.id, auto_approved })
}

export async function approveSubmission(
  id: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!canApproveSubmissions(user)) {
    return err('FORBIDDEN', 'Only super admins can approve submissions.')
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('deliverable_submissions')
    .select('id, status, client_id, deliverable_id, kind')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return err('NOT_FOUND')
  if (existing.status !== 'pending_approval') {
    return err('VALIDATION_FAILED', 'Submission is not pending approval.')
  }

  const { error } = await admin
    .from('deliverable_submissions')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id)

  if (error) return err('INTERNAL', `Failed to approve: ${error.message}`, error)

  if (existing.deliverable_id) {
    await incrementDeliverableCount(admin, existing.deliverable_id)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: id,
    action: 'approved',
    after: { kind: existing.kind, client_id: existing.client_id },
  })

  revalidatePath('/admin/submissions')
  revalidatePath('/admin/submissions/approvals')
  revalidatePath(`/admin/clients/${existing.client_id}`)
  revalidatePath('/overview')

  return ok({ id })
}

export async function rejectSubmission(
  id: string,
  reason: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!canApproveSubmissions(user)) {
    return err('FORBIDDEN', 'Only super admins can reject submissions.')
  }
  if (!reason?.trim()) {
    return err('VALIDATION_FAILED', 'A reason is required when rejecting.')
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('deliverable_submissions')
    .select('id, status, client_id, kind')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return err('NOT_FOUND')
  if (existing.status !== 'pending_approval') {
    return err('VALIDATION_FAILED', 'Submission is not pending approval.')
  }

  const { error } = await admin
    .from('deliverable_submissions')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('id', id)

  if (error) return err('INTERNAL', `Failed to reject: ${error.message}`, error)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: id,
    action: 'rejected',
    after: { kind: existing.kind, client_id: existing.client_id, reason: reason.trim() },
  })

  revalidatePath('/admin/submissions')
  revalidatePath('/admin/submissions/approvals')

  return ok({ id })
}

// Atomically bumps actual_count on the linked deliverable. Uses an RPC-style
// raw update with a CASE for the completed_at stamp on first count.
async function incrementDeliverableCount(
  admin: ReturnType<typeof createAdminClient>,
  deliverableId: string
) {
  const { data: row } = await admin
    .from('deliverables')
    .select('actual_count, target_count, custom_target_count, template_id, status')
    .eq('id', deliverableId)
    .maybeSingle()

  if (!row) return

  // Resolve target from template or custom column.
  let target: number | null = row.custom_target_count
  if (row.template_id) {
    const { data: tmpl } = await admin
      .from('package_deliverables')
      .select('target_count')
      .eq('id', row.template_id)
      .maybeSingle()
    target = tmpl?.target_count ?? null
  }

  const nextCount = (row.actual_count ?? 0) + 1
  const updates: Record<string, unknown> = {
    actual_count: nextCount,
    updated_at: new Date().toISOString(),
  }
  if (target !== null && nextCount >= target && row.status !== 'done') {
    updates.status = 'done'
    updates.completed_at = new Date().toISOString()
  } else if (row.status === 'pending') {
    updates.status = 'in_progress'
  }

  await admin.from('deliverables').update(updates).eq('id', deliverableId)
}
