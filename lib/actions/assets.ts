'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

const BUCKET = 'client-assets'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB — matches the bucket's file_size_limit

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return m ? m[1] : 'bin'
}

// Uploads an internal asset into a client's folder. Any file type; staff only.
export async function uploadClientAsset(formData: FormData): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can upload assets')

  const clientId = String(formData.get('client_id') ?? '')
  const taskId = (formData.get('task_id') as string) || null
  const file = formData.get('file')
  if (!clientId) return err('VALIDATION_FAILED', 'Missing client id')
  if (!(file instanceof File) || file.size === 0) return err('VALIDATION_FAILED', 'Choose a file to upload')
  if (file.size > MAX_BYTES) return err('VALIDATION_FAILED', 'File is larger than 50MB')

  const admin = createAdminClient()
  const storagePath = `${clientId}/${crypto.randomUUID()}.${extOf(file.name)}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return err('INTERNAL', `Upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await admin
    .from('client_assets')
    .insert({
      client_id: clientId,
      task_id: taskId,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single()
  if (insErr || !row) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return err('INTERNAL', `Failed to record asset: ${insErr?.message ?? 'no row'}`)
  }

  revalidatePath(`/admin/clients/${clientId}/assets`)
  return ok({ id: row.id })
}

export async function deleteClientAsset(
  assetId: string,
  clientId: string
): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can delete assets')
  if (!assetId) return err('VALIDATION_FAILED', 'Missing asset id')

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('client_assets')
    .select('storage_path')
    .eq('id', assetId)
    .maybeSingle()
  if (row?.storage_path) await admin.storage.from(BUCKET).remove([row.storage_path])
  const { error } = await admin.from('client_assets').delete().eq('id', assetId)
  if (error) return err('INTERNAL', `Delete failed: ${error.message}`)

  revalidatePath(`/admin/clients/${clientId}/assets`)
  return ok({ ok: true })
}

// Attach (or detach with null) an asset to one of the client's tasks.
export async function attachAssetToTask(
  assetId: string,
  clientId: string,
  taskId: string | null
): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can manage assets')
  if (!assetId) return err('VALIDATION_FAILED', 'Missing asset id')

  const admin = createAdminClient()
  const { error } = await admin.from('client_assets').update({ task_id: taskId }).eq('id', assetId)
  if (error) return err('INTERNAL', `Failed to attach: ${error.message}`)

  revalidatePath(`/admin/clients/${clientId}/assets`)
  return ok({ ok: true })
}
