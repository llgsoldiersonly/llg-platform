import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'lead-files'

// Streams a lead PDF via a short-lived signed URL. Authorization is the RLS
// read itself: the row is fetched with the caller's session, so it returns
// only when the user is staff or a client_user linked to that client.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: file } = await supabase
    .from('client_lead_files')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle()
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name })
  if (error || !signed) return NextResponse.json({ error: 'could not sign url' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl)
}
