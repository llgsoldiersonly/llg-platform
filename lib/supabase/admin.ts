import { createClient } from '@supabase/supabase-js'

// Service-role client. Bypasses RLS. Server-only — NEVER import from client components or pass to the browser.
// Used by cron jobs, server actions that need cross-tenant reads, and credential writes.
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient called in the browser — service-role key would leak.')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
