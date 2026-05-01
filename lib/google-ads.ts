// Google Ads OAuth helpers. Used by the /api/auth/google-ads/* routes
// during Phase 1 (authorization) and the data-fetch crons in Phase 2+.
//
// Architecture: ONE OAuth authorization at the agency MCC level.
// Refresh token lives in platform_settings.google_ads_refresh_token.
// All per-client API calls reuse the same token, scoped to the target
// customer_id via the request body.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Read-only scope is sufficient for the integration — we only PULL
// campaign data, never modify campaigns. Login scope is required so
// Google returns the user's identity in the callback (helps audit
// who connected the account).
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export type GoogleAdsEnv = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function readGoogleAdsEnv(): GoogleAdsEnv | null {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

/** Build the consent-screen URL we redirect the super-admin to. */
export function buildAuthorizationUrl(env: GoogleAdsEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',         // tells Google to return a refresh_token
    prompt: 'consent',              // forces refresh_token even on re-auth
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export type TokenExchangeResult = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

/** Exchange the one-time `code` for an access + refresh token pair. */
export async function exchangeCodeForTokens(
  env: GoogleAdsEnv,
  code: string
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: 'authorization_code',
    code,
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${errBody.slice(0, 300)}`)
  }
  return (await res.json()) as TokenExchangeResult
}
