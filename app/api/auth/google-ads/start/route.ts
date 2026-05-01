import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { readGoogleAdsEnv, buildAuthorizationUrl } from '@/lib/google-ads'

// Kicks off the Google Ads OAuth dance. Super-admin only — only the
// agency authority should be able to grant our app access to the MCC.
//
// CSRF protection: we set a cryptographic state cookie before redirecting
// and the callback verifies it matches the state Google returns.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'))
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ ok: false, error: 'super_admin required' }, { status: 403 })
  }

  const env = readGoogleAdsEnv()
  if (!env) {
    return NextResponse.json(
      {
        ok: false,
        error: 'GOOGLE_ADS_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI not configured in env.',
      },
      { status: 503 }
    )
  }

  const state = randomBytes(24).toString('hex')

  const jar = await cookies()
  jar.set('google_ads_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 minutes — OAuth flow should complete well within this
  })

  return NextResponse.redirect(buildAuthorizationUrl(env, state))
}
