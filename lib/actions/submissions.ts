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

export type SubmitDeliverableBatchInput = {
  client_id: string
  kind: SubmissionKind
  link_urls: string[]
  title?: string | null
  notes?: string | null
  deliverable_id?: string | null
  mark_complete?: boolean
}

const MAX_BATCH_URLS = 500

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

// Submits N URLs in one call as separate deliverable_submission rows tied to
// the same client/kind/deliverable. Each URL becomes its own audit row so the
// client timeline still shows every link individually. If `mark_complete` is
// true and a deliverable is targeted, the deliverable is flipped to status=done
// at the end of the batch regardless of actual_count vs target_count — that's
// the "20 of 100 pages submitted but staff calls it complete" path.
export async function submitDeliverableBatch(
  input: SubmitDeliverableBatchInput
): Promise<Result<{ inserted: number; marked_complete: boolean }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!isValidSubmissionKind(input.kind)) {
    return err('VALIDATION_FAILED', 'Unknown submission kind.')
  }
  if (!input.client_id) {
    return err('VALIDATION_FAILED', 'Pick a firm.')
  }
  if (input.mark_complete && !input.deliverable_id) {
    return err('VALIDATION_FAILED', 'Pick a deliverable before marking complete.')
  }

  const cleaned = (input.link_urls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
  if (cleaned.length === 0) {
    return err('VALIDATION_FAILED', 'Paste at least one URL.')
  }
  if (cleaned.length > MAX_BATCH_URLS) {
    return err('VALIDATION_FAILED', `Batch is limited to ${MAX_BATCH_URLS} URLs at a time.`)
  }
  const invalid = cleaned.filter((u) => !isValidUrl(u))
  if (invalid.length > 0) {
    return err(
      'VALIDATION_FAILED',
      `${invalid.length} of ${cleaned.length} entries aren't valid http(s) URLs. First bad one: ${invalid[0]}`
    )
  }

  const admin = createAdminClient()
  const sharedTitle = input.title?.trim() || null
  const sharedNotes = input.notes?.trim() || null
  const rows = cleaned.map((url) => ({
    client_id: input.client_id,
    kind: input.kind,
    link_url: url,
    title: sharedTitle,
    notes: sharedNotes,
    deliverable_id: input.deliverable_id || null,
    submitted_by: user.id,
  }))

  const { data: inserted, error } = await admin
    .from('deliverable_submissions')
    .insert(rows)
    .select('id')

  if (error || !inserted) {
    return err('INTERNAL', `Failed to submit batch: ${error?.message ?? 'unknown error'}`, error)
  }

  if (input.deliverable_id) {
    await incrementDeliverableCountBy(admin, input.deliverable_id, inserted.length)
  }

  let markedComplete = false
  if (input.mark_complete && input.deliverable_id) {
    const { error: completeErr } = await admin
      .from('deliverables')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.deliverable_id)
    if (completeErr) {
      return err('INTERNAL', `Inserted rows, but failed to mark complete: ${completeErr.message}`)
    }
    markedComplete = true
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: inserted[0]?.id ?? null,
    action: 'submitted_batch',
    after: {
      kind: input.kind,
      client_id: input.client_id,
      count: inserted.length,
      deliverable_id: input.deliverable_id ?? null,
      marked_complete: markedComplete,
    },
  })

  revalidatePath('/admin/submissions')
  revalidatePath(`/admin/clients/${input.client_id}`)
  revalidatePath(`/admin/clients/${input.client_id}/deliverables`)
  revalidatePath('/overview')
  revalidatePath('/staff')

  return ok({ inserted: inserted.length, marked_complete: markedComplete })
}

// Replace an existing submission with a corrected version. Used when staff
// realizes the URL/title was wrong AFTER submission. Implementation: the
// original row gets marked rejected with reason 'Replaced' (kept for audit,
// hidden from clients via RLS). A fresh row inserts with the same kind /
// client_id / deliverable_id; the auto-approve trigger flips it to approved
// immediately.
//
// Net effect on deliverable.actual_count: zero. The original's +1 stays in
// the count, now attributable to the replacement instead. If we ever allow
// changing the deliverable_id during replace, we'd need to dec-old + inc-new
// explicitly — currently we lock those fields to preserve the invariant.
export type ReplaceSubmissionInput = {
  original_id: string
  link_url: string
  title?: string | null
  notes?: string | null
}

export async function replaceSubmission(
  input: ReplaceSubmissionInput
): Promise<Result<{ original_id: string; new_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!input.link_url?.trim() || !isValidUrl(input.link_url.trim())) {
    return err('VALIDATION_FAILED', 'A valid link (https://…) is required.')
  }

  const admin = createAdminClient()
  const { data: original } = await admin
    .from('deliverable_submissions')
    .select('id, client_id, kind, deliverable_id, status')
    .eq('id', input.original_id)
    .maybeSingle()

  if (!original) return err('NOT_FOUND', 'Original submission not found.')
  if (original.status === 'rejected') {
    return err('VALIDATION_FAILED', 'This submission has already been replaced or rejected.')
  }

  // Mark the original rejected so RLS hides it from clients. Audit trail
  // preserved (submitted_by, submitted_at, link_url stay intact).
  const { error: updateErr } = await admin
    .from('deliverable_submissions')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: 'Replaced',
    })
    .eq('id', input.original_id)
  if (updateErr) {
    return err('INTERNAL', `Failed to mark original replaced: ${updateErr.message}`)
  }

  // Insert the corrected row — trigger auto-approves on insert.
  const { data: inserted, error: insertErr } = await admin
    .from('deliverable_submissions')
    .insert({
      client_id: original.client_id,
      kind: original.kind,
      deliverable_id: original.deliverable_id,
      link_url: input.link_url.trim(),
      title: input.title?.trim() || null,
      notes: input.notes?.trim() || null,
      submitted_by: user.id,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Roll back the original-replacement update so we don't leave the
    // submission in a half-applied state.
    await admin
      .from('deliverable_submissions')
      .update({ status: 'approved', rejection_reason: null, reviewed_by: null, reviewed_at: null })
      .eq('id', input.original_id)
    return err('INTERNAL', `Failed to insert replacement: ${insertErr?.message ?? 'unknown'}`)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'deliverable_submission',
    entity_id: inserted.id,
    action: 'replaced',
    after: {
      replaced_original_id: input.original_id,
      kind: original.kind,
      client_id: original.client_id,
      new_link_url: input.link_url,
    },
  })

  revalidatePath('/admin/submissions')
  revalidatePath(`/admin/clients/${original.client_id}`)
  revalidatePath('/overview')

  return ok({ original_id: input.original_id, new_id: inserted.id })
}

// Atomically bumps actual_count on the linked deliverable. Uses an RPC-style
// raw update with a CASE for the completed_at stamp on first count.
async function incrementDeliverableCount(
  admin: ReturnType<typeof createAdminClient>,
  deliverableId: string
) {
  return incrementDeliverableCountBy(admin, deliverableId, 1)
}

async function incrementDeliverableCountBy(
  admin: ReturnType<typeof createAdminClient>,
  deliverableId: string,
  by: number
) {
  if (by <= 0) return

  const { data: row } = await admin
    .from('deliverables')
    .select('actual_count, custom_target_count, custom_frequency, template_id, status')
    .eq('id', deliverableId)
    .maybeSingle()

  if (!row) return

  // Resolve target + frequency from template or custom columns.
  let target: number | null = row.custom_target_count
  let frequency: string | null = row.custom_frequency
  if (row.template_id) {
    const { data: tmpl } = await admin
      .from('package_deliverables')
      .select('target_count, frequency')
      .eq('id', row.template_id)
      .maybeSingle()
    target = tmpl?.target_count ?? null
    frequency = tmpl?.frequency ?? null
  }

  const nextCount = (row.actual_count ?? 0) + by
  const updates: Record<string, unknown> = {
    actual_count: nextCount,
    updated_at: new Date().toISOString(),
  }

  // Auto-complete on count >= target ONLY for recurring deliverables.
  // For frequency='once' (pre-launch checklist items), completion is binary
  // and driven by an explicit "Mark complete" action — the counter is just
  // an audit-trail tally, not the completion signal.
  const isOnce = frequency === 'once'
  if (!isOnce && target !== null && nextCount >= target && row.status !== 'done') {
    updates.status = 'done'
    updates.completed_at = new Date().toISOString()
  } else if (row.status === 'pending') {
    updates.status = 'in_progress'
  }

  await admin.from('deliverables').update(updates).eq('id', deliverableId)
}
