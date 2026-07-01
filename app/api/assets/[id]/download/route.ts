import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'client-assets'

// Serves an internal client asset via a short-lived signed URL. Authorization
// is the RLS read: client_assets has only a staff policy, so the row returns
// only for staff/super_admin — clients can never reach this.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: asset } = await supabase
    .from('client_assets')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle()
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(asset.storage_path, 60, { download: asset.file_name })
  if (error || !signed) return NextResponse.json({ error: 'could not sign url' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl)
}
