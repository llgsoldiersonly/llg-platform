'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff, isSuperAdmin } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import type { User } from '@supabase/supabase-js'

const BUCKET = 'intake-files'
const MAX_BYTES = 50 * 1024 * 1024 // matches the bucket's file_size_limit

// Retainers must be PDFs; supporting docs can be PDFs or photos.
const RETAINER_EXT = new Set(['pdf'])
const SUPPORT_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'])

export type IntakeMode = 'none' | 'intakes_only' | 'intakes_leads'
export type IntakeLeadStatus = 'new' | 'retained' | 'referred_out' | 'dropped'

// The internal intake workspace is for super-admins and members of the
// Intake department (departments.slug = 'intake').
export async function canAccessIntakes(
  admin: ReturnType<typeof createAdminClient>,
  user: User
): Promise<boolean> {
  if (isSuperAdmin(user)) return true
  if (!isAgencyStaff(user)) return false
  const { data } = await admin
    .from('profiles')
    .select('department:departments(slug)')
    .eq('id', user.id)
    .maybeSingle<{ department: { slug: string } | null }>()
  return data?.department?.slug === 'intake'
}

async function requireIntakeAccess(): Promise<
  | { ok: true; user: User; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: Result<never> }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: err('UNAUTHORIZED') }
  const admin = createAdminClient()
  if (!(await canAccessIntakes(admin, user))) {
    return { ok: false, error: err('FORBIDDEN', 'Intake team and super-admins only.') }
  }
  return { ok: true, user, admin }
}

// Super-admin only: put a firm on (or off) the intake service, choosing the
// kind. 'intakes_only' also flips their client portal to intake-only.
export async function setClientIntakeMode(clientId: string, mode: IntakeMode): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only a super-admin can change a firm\'s intake service.')
  if (!clientId || !['none', 'intakes_only', 'intakes_leads'].includes(mode)) {
    return err('VALIDATION_FAILED', 'Bad client or mode')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('clients').update({ intake_mode: mode }).eq('id', clientId)
  if (error) return err('INTERNAL', `Failed to update: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'client',
    entity_id: clientId,
    action: 'updated',
    after: { intake_mode: mode },
  })

  revalidatePath('/admin/intakes')
  return ok({ ok: true })
}

export type CreateIntakeLeadInput = {
  client_id: string
  lead_name: string
  lead_phone?: string | null
  date_of_loss?: string | null
  at_fault_name?: string | null
  at_fault_phone?: string | null
  at_fault_license?: string | null
  at_fault_insurance?: string | null
  description?: string | null
}

export async function createIntakeLead(input: CreateIntakeLeadInput): Promise<Result<{ id: string }>> {
  const gate = await requireIntakeAccess()
  if (!gate.ok) return gate.error
  const { user, admin } = gate

  if (!input.client_id) return err('VALIDATION_FAILED', 'Missing client')
  if (!input.lead_name?.trim()) return err('VALIDATION_FAILED', 'Lead name is required')

  const { data: row, error } = await admin
    .from('intake_leads')
    .insert({
      client_id: input.client_id,
      lead_name: input.lead_name.trim(),
      lead_phone: input.lead_phone?.trim() || null,
      date_of_loss: input.date_of_loss || null,
      at_fault_name: input.at_fault_name?.trim() || null,
      at_fault_phone: input.at_fault_phone?.trim() || null,
      at_fault_license: input.at_fault_license?.trim() || null,
      at_fault_insurance: input.at_fault_insurance?.trim() || null,
      description: input.description?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !row) return err('INTERNAL', `Failed to create lead: ${error?.message ?? 'no row'}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'intake_lead',
    entity_id: row.id,
    action: 'created',
    after: { client_id: input.client_id, lead_name: input.lead_name.trim() },
  })

  revalidatePath(`/admin/intakes/${input.client_id}`)
  revalidatePath('/admin/intakes')
  return ok({ id: row.id })
}

export async function updateIntakeLeadStatus(
  leadId: string,
  status: IntakeLeadStatus
): Promise<Result<{ id: string }>> {
  const gate = await requireIntakeAccess()
  if (!gate.ok) return gate.error
  const { user, admin } = gate

  if (!['new', 'retained', 'referred_out', 'dropped'].includes(status)) {
    return err('VALIDATION_FAILED', 'Bad status')
  }

  const { data: lead, error } = await admin
    .from('intake_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select('client_id')
    .single<{ client_id: string }>()
  if (error || !lead) return err('INTERNAL', `Failed to update: ${error?.message ?? 'no row'}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'intake_lead',
    entity_id: leadId,
    action: 'updated',
    after: { status },
  })

  revalidatePath(`/admin/intakes/${lead.client_id}`)
  return ok({ id: leadId })
}

// Super-admin only — intake staff can drop a lead (status), not erase it.
export async function deleteIntakeLead(leadId: string): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only a super-admin can delete a lead.')

  const admin = createAdminClient()
  const { data: files } = await admin
    .from('intake_lead_files')
    .select('storage_path')
    .eq('lead_id', leadId)
    .returns<{ storage_path: string }[]>()
  if (files && files.length > 0) {
    await admin.storage.from(BUCKET).remove(files.map((f) => f.storage_path))
  }
  const { data: lead, error } = await admin
    .from('intake_leads')
    .delete()
    .eq('id', leadId)
    .select('client_id')
    .maybeSingle<{ client_id: string }>()
  if (error) return err('INTERNAL', `Delete failed: ${error.message}`)

  if (lead) revalidatePath(`/admin/intakes/${lead.client_id}`)
  revalidatePath('/admin/intakes')
  return ok({ ok: true })
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return m ? m[1] : 'bin'
}

// kind 'retainer' (single signed-retainer PDF — replaces any prior one and
// flips the lead to Retained) or 'support' (any number of PDFs/photos).
export async function uploadIntakeFile(formData: FormData): Promise<Result<{ id: string }>> {
  const gate = await requireIntakeAccess()
  if (!gate.ok) return gate.error
  const { user, admin } = gate

  const leadId = String(formData.get('lead_id') ?? '')
  const kind = String(formData.get('kind') ?? '')
  const file = formData.get('file')
  if (!leadId || (kind !== 'retainer' && kind !== 'support')) return err('VALIDATION_FAILED', 'Bad upload target')
  if (!(file instanceof File) || file.size === 0) return err('VALIDATION_FAILED', 'Choose a file')
  if (file.size > MAX_BYTES) return err('VALIDATION_FAILED', 'File is larger than 50MB')

  const ext = extOf(file.name)
  const allowed = kind === 'retainer' ? RETAINER_EXT : SUPPORT_EXT
  if (!allowed.has(ext)) {
    return err(
      'VALIDATION_FAILED',
      kind === 'retainer'
        ? 'The signed retainer must be a PDF.'
        : `That file type (.${ext}) isn't allowed. Use a PDF or an image.`
    )
  }

  const { data: lead } = await admin
    .from('intake_leads')
    .select('client_id')
    .eq('id', leadId)
    .maybeSingle<{ client_id: string }>()
  if (!lead) return err('NOT_FOUND', 'Lead not found')

  const storagePath = `${lead.client_id}/${leadId}/${kind}-${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return err('INTERNAL', `Upload failed: ${upErr.message}`)

  // One retainer per lead: replace any existing one.
  if (kind === 'retainer') {
    const { data: old } = await admin
      .from('intake_lead_files')
      .select('id, storage_path')
      .eq('lead_id', leadId)
      .eq('kind', 'retainer')
      .returns<{ id: string; storage_path: string }[]>()
    if (old && old.length > 0) {
      await admin.storage.from(BUCKET).remove(old.map((f) => f.storage_path))
      await admin.from('intake_lead_files').delete().eq('lead_id', leadId).eq('kind', 'retainer')
    }
  }

  const { data: row, error: insErr } = await admin
    .from('intake_lead_files')
    .insert({
      lead_id: leadId,
      kind,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (insErr || !row) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return err('INTERNAL', `Failed to record file: ${insErr?.message ?? 'no row'}`)
  }

  // A signed retainer means the lead is retained — flip status automatically.
  if (kind === 'retainer') {
    await admin
      .from('intake_leads')
      .update({ status: 'retained', updated_at: new Date().toISOString() })
      .eq('id', leadId)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'intake_lead',
    entity_id: leadId,
    action: `uploaded ${kind === 'retainer' ? 'signed retainer' : 'document'}: ${file.name}`,
  })

  revalidatePath(`/admin/intakes/${lead.client_id}`)
  return ok({ id: row.id })
}

export type ClientDecision = 'accepted' | 'not_accepted' | 'disengaged'

// The firm's verdict on a lead, set from the client portal. Authorization is
// the caller's own RLS read: a client user can only select leads belonging
// to their firm, so a successful read proves the right to decide. Staff can
// also set it (relaying a firm's phone/email answer).
export async function setLeadClientDecision(
  leadId: string,
  decision: ClientDecision
): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!['accepted', 'not_accepted', 'disengaged'].includes(decision)) {
    return err('VALIDATION_FAILED', 'Bad decision')
  }

  const { data: visible } = await supabase
    .from('intake_leads')
    .select('id, client_id')
    .eq('id', leadId)
    .maybeSingle<{ id: string; client_id: string }>()
  if (!visible) return err('NOT_FOUND', 'Lead not found')

  const admin = createAdminClient()
  const { error } = await admin
    .from('intake_leads')
    .update({
      client_decision: decision,
      client_decision_at: new Date().toISOString(),
      client_decision_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
  if (error) return err('INTERNAL', `Failed to save decision: ${error.message}`)

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'intake_lead',
    entity_id: leadId,
    action: 'updated',
    after: { client_decision: decision },
  })

  revalidatePath('/intakes')
  revalidatePath(`/admin/intakes/${visible.client_id}`)
  return ok({ id: leadId })
}

export async function deleteIntakeFile(fileId: string): Promise<Result<{ ok: true }>> {
  const gate = await requireIntakeAccess()
  if (!gate.ok) return gate.error
  const { admin } = gate

  const { data: row } = await admin
    .from('intake_lead_files')
    .select('storage_path, lead_id, lead:intake_leads(client_id)')
    .eq('id', fileId)
    .maybeSingle<{ storage_path: string; lead_id: string; lead: { client_id: string } | null }>()
  if (!row) return err('NOT_FOUND', 'File not found')

  await admin.storage.from(BUCKET).remove([row.storage_path])
  const { error } = await admin.from('intake_lead_files').delete().eq('id', fileId)
  if (error) return err('INTERNAL', `Delete failed: ${error.message}`)

  if (row.lead?.client_id) revalidatePath(`/admin/intakes/${row.lead.client_id}`)
  return ok({ ok: true })
}
