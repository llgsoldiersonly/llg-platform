import { cookies } from 'next/headers'

// Super-admin "View as client" mode. Staff session stays the same; we just
// pin the client portal to a specific client_id via these cookies. Banner +
// audit row in impersonation_log are how we surface and track it.
export const IMPERSONATION_CLIENT_COOKIE = 'llg_impersonate_client_id'
export const IMPERSONATION_LOG_COOKIE = 'llg_impersonate_log_id'

export type ActiveImpersonation = {
  clientId: string
  logId: string
}

export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  const jar = await cookies()
  const clientId = jar.get(IMPERSONATION_CLIENT_COOKIE)?.value
  const logId = jar.get(IMPERSONATION_LOG_COOKIE)?.value
  if (!clientId || !logId) return null
  return { clientId, logId }
}
