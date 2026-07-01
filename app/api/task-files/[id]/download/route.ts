import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'task-files'

// Serves a task attachment via a short-lived signed URL. Authorization is the
// RLS read: task_files has only a staff policy, so the row returns only for
// staff/super_admin. Default is inline (so images/PDF/video preview in the
// browser); pass ?dl=1 to force a download.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: file } = await supabase
    .from('task_files')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle()
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const forceDownload = req.nextUrl.searchParams.get('dl') === '1'
  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, forceDownload ? { download: file.file_name } : undefined)
  if (error || !signed) return NextResponse.json({ error: 'could not sign url' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl)
}
