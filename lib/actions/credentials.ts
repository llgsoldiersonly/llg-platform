'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

export type CredentialFields = {
  client_id: string
  wp_username?: string | null
  wp_app_password?: string | null
  wp_language_method?: 'polylang' | 'wpml' | 'category' | 'tag' | 'path' | 'none'
  wp_language_en_value?: string | null
  wp_language_es_value?: string | null
  callrail_account_id?: string | null
  callrail_company_id?: string | null
  metricool_user_id?: string | null
  metricool_blog_id?: string | null
  brightlocal_client_id?: string | null
  ga4_property_url?: string | null
  ga4_property_id?: string | null
  google_ads_account_url?: string | null
  google_ads_customer_id?: string | null
  lsa_account_url?: string | null
  gsc_property_url?: string | null
  gsc_resource_id?: string | null
}

// Server action — saves credentials for a client. Only staff may call.
// Uses service-role client so RLS doesn't block the upsert. The wp_app_password
// field should ideally be encrypted before storage; that's a Phase 8+ hardening
// pass (see APPENDIX A in the handoff). For now stored plaintext.
export async function saveCredentials(input: CredentialFields): Promise<Result<{ client_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  // Empty strings → null so we don't store '' which is hard to filter on
  const cleaned: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(input)) {
    if (k === 'client_id') continue
    cleaned[k] = typeof v === 'string' && v.trim() === '' ? null : (v ?? null)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_credentials')
    .upsert(
      { client_id: input.client_id, ...cleaned, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'client_id' }
    )

  if (error) {
    return err('INTERNAL', `Failed to save credentials: ${error.message}`, error)
  }

  revalidatePath(`/admin/clients/${input.client_id}/credentials`)
  return ok({ client_id: input.client_id })
}
