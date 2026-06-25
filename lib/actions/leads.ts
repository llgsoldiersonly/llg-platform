'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

const BUCKET = 'lead-files'
const MAX_BYTES = 25 * 1024 * 1024 // 25MB — matches the bucket's file_size_limit

// Toggle the Leads box on/off for a client.
export async function setClientLeadsEnabled(
  clientId: string,
  enabled: boolean
): Promise<Result<{ enabled: boolean }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can manage leads')
  if (!clientId) return err('VALIDATION_FAILED', 'Missing client id')

  const admin = createAdminClient()
  const { error } = await admin.from('clients').update({ leads_enabled: enabled }).eq('id', clientId)
  if (error) return err('INTERNAL', `Failed to update: ${error.message}`)

  revalidatePath(`/admin/clients/${clientId}/leads`)
  revalidatePath(`/admin/clients/${clientId}`)
  return ok({ enabled })
}

// Uploads a single PDF lead for a client. Called from a client component with
// FormData carrying the file (server actions stream the File for us).
export async function uploadLeadFile(formData: FormData): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can upload leads')

  const clientId = String(formData.get('client_id') ?? '')
  const file = formData.get('file')
  if (!clientId) return err('VALIDATION_FAILED', 'Missing client id')
  if (!(file instanceof File) || file.size === 0) return err('VALIDATION_FAILED', 'Choose a PDF to upload')
  if (file.type !== 'application/pdf') return err('VALIDATION_FAILED', 'Only PDF files are allowed')
  if (file.size > MAX_BYTES) return err('VALIDATION_FAILED', 'File is larger than 25MB')

  const admin = createAdminClient()
  // Random object name; keep the original name only as display metadata.
  const ext = 'pdf'
  const objectName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${clientId}/${objectName}`

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false })
  if (upErr) return err('INTERNAL', `Upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await admin
    .from('client_lead_files')
    .insert({
      client_id: clientId,
      storage_path: storagePath,
      file_name: file.name,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single()
  if (insErr || !row) {
    // Roll back the orphaned object so we don't leave untracked files.
    await admin.storage.from(BUCKET).remove([storagePath])
    return err('INTERNAL', `Failed to record file: ${insErr?.message ?? 'no row'}`)
  }

  revalidatePath(`/admin/clients/${clientId}/leads`)
  return ok({ id: row.id })
}

export async function deleteLeadFile(
  fileId: string,
  clientId: string
): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can delete leads')
  if (!fileId) return err('VALIDATION_FAILED', 'Missing file id')

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('client_lead_files')
    .select('storage_path')
    .eq('id', fileId)
    .maybeSingle()
  if (row?.storage_path) {
    await admin.storage.from(BUCKET).remove([row.storage_path])
  }
  const { error } = await admin.from('client_lead_files').delete().eq('id', fileId)
  if (error) return err('INTERNAL', `Delete failed: ${error.message}`)

  revalidatePath(`/admin/clients/${clientId}/leads`)
  return ok({ ok: true })
}
