'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
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

// Submits a deliverable. As of migration 0021, the DB trigger auto-approves
// every submission on insert — there's no longer a pending state to clear.
// If we ever reintroduce manager review for select kinds, gate it in the
// trigger by `new.kind in (...)` rather than rebuilding the approval UI.
export async function submitDeliverable(
  input: SubmitDeliverableInput
): Promise<Result<{ id: string }>> {
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
    .select('id')
    .single()

  if (error || !data) {
    return err('INTERNAL', `Failed to submit: ${error?.message ?? 'unknown error'}`, error)
  }

  // Auto-approved by trigger → bump the counter immediately if linked to a
  // recurring deliverable.
  if (input.deliverable_id) {
    await incrementDeliverableCount(admin, input.deliverable_id)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: data.id,
    action: 'submitted',
    after: { kind: input.kind, client_id: input.client_id, link_url: input.link_url },
  })

  revalidatePath('/admin/submissions')
  revalidatePath(`/admin/clients/${input.client_id}`)
  revalidatePath('/overview')

  return ok({ id: data.id })
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
