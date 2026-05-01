import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { readGoogleAdsEnv, exchangeCodeForTokens } from '@/lib/google-ads'

// OAuth callback — Google redirects the super-admin here after they grant
// (or decline) consent. We:
//   1. Verify the user is still super_admin (re-check, not just trust state).
//   2. Verify the `state` matches the cookie we set in /start.
//   3. Exchange `code` for access + refresh tokens.
//   4. Persist refresh token in platform_settings.
//   5. Redirect back to /admin/settings/users with a flash result.
function redirectBack(url: URL, kind: 'success' | 'error', detail?: string) {
  const target = new URL('/admin/settings/users', url)
  target.searchParams.set('google_ads', kind)
  if (detail) target.searchParams.set('google_ads_detail', detail)
  return NextResponse.redirect(target)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return redirectBack(url, 'error', oauthError)
  }
  if (!code || !state) {
    return redirectBack(url, 'error', 'missing_code_or_state')
  }

  const jar = await cookies()
  const expectedState = jar.get('google_ads_oauth_state')?.value
  jar.delete('google_ads_oauth_state')
  if (!expectedState || expectedState !== state) {
    return redirectBack(url, 'error', 'state_mismatch')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirectBack(url, 'error', 'not_authenticated')
  if (!isSuperAdmin(user)) return redirectBack(url, 'error', 'super_admin_required')

  const env = readGoogleAdsEnv()
  if (!env) return redirectBack(url, 'error', 'env_not_configured')

  let tokens
  try {
    tokens = await exchangeCodeForTokens(env, code)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return redirectBack(url, 'error', `exchange_failed: ${message.slice(0, 80)}`)
  }

  if (!tokens.refresh_token) {
    // Google only returns a refresh token on the FIRST consent (or with
    // prompt=consent). Should never happen given /start uses prompt=consent,
    // but be explicit.
    return redirectBack(url, 'error', 'no_refresh_token_returned')
  }

  const admin = createAdminClient()
  const { error: updateErr } = await admin
    .from('platform_settings')
    .update({ google_ads_refresh_token: tokens.refresh_token })
    .eq('id', 1)
  if (updateErr) {
    return redirectBack(url, 'error', `db_write_failed: ${updateErr.message.slice(0, 80)}`)
  }

  return redirectBack(url, 'success')
}
