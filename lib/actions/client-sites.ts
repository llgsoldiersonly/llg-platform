'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { normalizeDomain } from '@/lib/integrations/dataforseo/normalize'
import { ok, err, type Result } from '@/lib/errors'

export type ClientSiteInput = {
  client_id: string
  domain: string
  label?: string | null
  purpose?: string | null
  is_primary?: boolean
  is_active?: boolean
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = v?.trim()
  return t ? t : null
}

// Promotes one site to primary and demotes the rest, in order: demote others
// FIRST so the one-primary-per-client unique index never trips. The
// clients.primary_domain mirror trigger fires on each write.
async function makePrimary(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  siteId: string,
): Promise<string | null> {
  const { error: demoteErr } = await admin
    .from('client_sites')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .neq('id', siteId)
  if (demoteErr) return demoteErr.message
  const { error: promoteErr } = await admin
    .from('client_sites')
    .update({ is_primary: true, is_active: true, updated_at: new Date().toISOString() })
    .eq('id', siteId)
  if (promoteErr) return promoteErr.message
  return null
}

export async function createClientSite(
  input: ClientSiteInput,
): Promise<Result<{ site_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can manage sites')

  const domain = normalizeDomain(input.domain)
  if (!domain || !domain.includes('.')) return err('VALIDATION_FAILED', 'Enter a valid domain')
  if (!input.client_id) return err('VALIDATION_FAILED', 'Missing client_id')

  const admin = createAdminClient()

  // First site for a client is primary by default.
  const { count } = await admin
    .from('client_sites')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', input.client_id)
  const isFirst = (count ?? 0) === 0
  const wantPrimary = input.is_primary ?? isFirst

  const { data: site, error: insErr } = await admin
    .from('client_sites')
    .insert({
      client_id: input.client_id,
      domain,
      label: trimOrNull(input.label),
      purpose: trimOrNull(input.purpose),
      is_primary: false, // set via makePrimary so the demote-first ordering holds
      is_active: input.is_active ?? true,
    })
    .select('id')
    .single()
  if (insErr || !site) {
    if (insErr?.code === '23505') return err('VALIDATION_FAILED', 'That domain is already on this client')
    return err('INTERNAL', `Failed to add site: ${insErr?.message ?? 'no row returned'}`)
  }

  if (wantPrimary) {
    const pErr = await makePrimary(admin, input.client_id, site.id)
    if (pErr) return err('INTERNAL', `Site added but promote failed: ${pErr}`)
  }

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ site_id: site.id })
}

export type UpdateClientSiteInput = {
  id: string
  client_id: string
  domain?: string
  label?: string | null
  purpose?: string | null
  is_active?: boolean
}

export async function updateClientSite(
  input: UpdateClientSiteInput,
): Promise<Result<{ site_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can manage sites')
  if (!input.id || !input.client_id) return err('VALIDATION_FAILED', 'Missing site id')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.domain !== undefined) {
    const domain = normalizeDomain(input.domain)
    if (!domain || !domain.includes('.')) return err('VALIDATION_FAILED', 'Enter a valid domain')
    patch.domain = domain
  }
  if (input.label !== undefined) patch.label = trimOrNull(input.label)
  if (input.purpose !== undefined) patch.purpose = trimOrNull(input.purpose)
  if (input.is_active !== undefined) patch.is_active = input.is_active

  const admin = createAdminClient()

  // Guard: don't let the primary site be deactivated — it backs primary_domain.
  if (input.is_active === false) {
    const { data: row } = await admin
      .from('client_sites')
      .select('is_primary')
      .eq('id', input.id)
      .maybeSingle()
    if (row?.is_primary) {
      return err('VALIDATION_FAILED', 'Make another site primary before deactivating this one')
    }
  }

  const { error: updErr } = await admin.from('client_sites').update(patch).eq('id', input.id)
  if (updErr) {
    if (updErr.code === '23505') return err('VALIDATION_FAILED', 'That domain is already on this client')
    return err('INTERNAL', `Failed to update site: ${updErr.message}`)
  }

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ site_id: input.id })
}

export async function setPrimaryClientSite(
  input: { id: string; client_id: string },
): Promise<Result<{ site_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can manage sites')
  if (!input.id || !input.client_id) return err('VALIDATION_FAILED', 'Missing site id')

  const admin = createAdminClient()
  const pErr = await makePrimary(admin, input.client_id, input.id)
  if (pErr) return err('INTERNAL', `Failed to set primary: ${pErr}`)

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ site_id: input.id })
}

export async function deleteClientSite(
  input: { id: string; client_id: string },
): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can manage sites')
  if (!input.id || !input.client_id) return err('VALIDATION_FAILED', 'Missing site id')

  const admin = createAdminClient()

  // Don't delete the primary — it backs clients.primary_domain. Promote another first.
  const { data: row } = await admin
    .from('client_sites')
    .select('is_primary')
    .eq('id', input.id)
    .maybeSingle()
  if (row?.is_primary) {
    return err('VALIDATION_FAILED', 'Make another site primary before removing this one')
  }

  const { error: delErr } = await admin.from('client_sites').delete().eq('id', input.id)
  if (delErr) return err('INTERNAL', `Failed to remove site: ${delErr.message}`)

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ ok: true })
}
