'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

const BUCKET = 'task-files'
const MAX_BYTES = 200 * 1024 * 1024 // 200MB — matches the bucket's file_size_limit

// Allowed by extension (browser MIME types for docx/csv are unreliable):
// images, video, pdf, docx/doc, csv, xlsx/xls.
const ALLOWED_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'mp4', 'mov', 'webm', 'm4v',
  'pdf', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'txt',
])

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return m ? m[1] : 'bin'
}

export async function uploadTaskFile(formData: FormData): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can attach files')

  const taskId = String(formData.get('task_id') ?? '')
  const file = formData.get('file')
  if (!taskId) return err('VALIDATION_FAILED', 'Missing task id')
  if (!(file instanceof File) || file.size === 0) return err('VALIDATION_FAILED', 'Choose a file to attach')
  if (file.size > MAX_BYTES) return err('VALIDATION_FAILED', 'File is larger than 200MB')

  const ext = extOf(file.name)
  if (!ALLOWED_EXT.has(ext)) {
    return err('VALIDATION_FAILED', `That file type (.${ext}) isn't allowed. Use an image, video, PDF, Word, CSV, or Excel file.`)
  }

  const admin = createAdminClient()
  const storagePath = `${taskId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return err('INTERNAL', `Upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await admin
    .from('task_files')
    .insert({
      task_id: taskId,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single<{ id: string }>()
  if (insErr || !row) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return err('INTERNAL', `Failed to record file: ${insErr?.message ?? 'no row'}`)
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'task',
    entity_id: taskId,
    action: `attached ${file.name}`,
  })

  revalidatePath(`/admin/tasks/${taskId}`)
  revalidatePath(`/staff/tasks/${taskId}`)
  return ok({ id: row.id })
}

export async function deleteTaskFile(fileId: string, taskId: string): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN', 'Only staff can delete files')
  if (!fileId) return err('VALIDATION_FAILED', 'Missing file id')

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('task_files')
    .select('storage_path')
    .eq('id', fileId)
    .maybeSingle<{ storage_path: string }>()
  if (row?.storage_path) await admin.storage.from(BUCKET).remove([row.storage_path])
  const { error } = await admin.from('task_files').delete().eq('id', fileId)
  if (error) return err('INTERNAL', `Delete failed: ${error.message}`)

  revalidatePath(`/admin/tasks/${taskId}`)
  revalidatePath(`/staff/tasks/${taskId}`)
  return ok({ ok: true })
}
