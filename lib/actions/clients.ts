'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

type ClientStatus = 'prospect' | 'onboarding' | 'active' | 'paused' | 'churned'

const STATUSES: ClientStatus[] = ['prospect', 'onboarding', 'active', 'paused', 'churned']

export type CreateClientInput = {
  firm_name: string
  primary_domain?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  vertical?: string | null
  status?: ClientStatus
  is_demo_only?: boolean
  notes?: string | null
  // Primary location — at least one is created so subscriptions can attach to it.
  location_label?: string | null
  location_city: string
  location_state: string
  // Subscription — required. Fully provisions the client (the on-insert trigger
  // from migration 0013 generates onboarding tasks; the period-rollover cron
  // materializes deliverables for the active subscription).
  package_id: string
  started_at?: string | null
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = v?.trim()
  return t ? t : null
}

// Creates a client end-to-end: the clients row, a primary location, and the
// first subscription — mirroring scripts/seed-demo.ts but for a real firm and
// driven from the admin UI. Best-effort rollback: if a downstream insert fails
// the client row is deleted (cascades to location) so we don't leave orphans.
export async function createClientFirm(
  input: CreateClientInput
): Promise<Result<{ client_id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can create clients')

  const firmName = trimOrNull(input.firm_name)
  const city = trimOrNull(input.location_city)
  const state = trimOrNull(input.location_state)
  if (!firmName) return err('VALIDATION_FAILED', 'Firm name is required')
  if (!city) return err('VALIDATION_FAILED', 'Primary location city is required')
  if (!state) return err('VALIDATION_FAILED', 'Primary location state is required')
  if (!input.package_id) return err('VALIDATION_FAILED', 'A package is required')

  const status: ClientStatus =
    input.status && STATUSES.includes(input.status) ? input.status : 'onboarding'
  const startedAt = trimOrNull(input.started_at) ?? new Date().toISOString().slice(0, 10)

  const admin = createAdminClient()

  // 1. Verify the package exists before creating anything.
  const { data: pkg, error: pkgErr } = await admin
    .from('package_templates')
    .select('id')
    .eq('id', input.package_id)
    .maybeSingle()
  if (pkgErr) return err('INTERNAL', `Package lookup failed: ${pkgErr.message}`)
  if (!pkg) return err('VALIDATION_FAILED', 'Selected package does not exist')

  // 2. Insert the client row.
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .insert({
      firm_name: firmName,
      primary_domain: trimOrNull(input.primary_domain),
      primary_contact_name: trimOrNull(input.primary_contact_name),
      primary_contact_email: trimOrNull(input.primary_contact_email),
      primary_contact_phone: trimOrNull(input.primary_contact_phone),
      vertical: trimOrNull(input.vertical),
      status,
      is_demo_only: input.is_demo_only ?? false,
      notes: trimOrNull(input.notes),
      onboarded_at: startedAt,
    })
    .select('id')
    .single()
  if (clientErr || !client) {
    return err('INTERNAL', `Failed to create client: ${clientErr?.message ?? 'no row returned'}`)
  }

  // 3. Insert the primary location.
  const { data: location, error: locationErr } = await admin
    .from('client_locations')
    .insert({
      client_id: client.id,
      label: trimOrNull(input.location_label) ?? 'Main Office',
      city,
      state,
      is_primary: true,
    })
    .select('id')
    .single()
  if (locationErr || !location) {
    await admin.from('clients').delete().eq('id', client.id)
    return err('INTERNAL', `Failed to create location: ${locationErr?.message ?? 'no row returned'}`)
  }

  // 4. Insert the subscription. The 0013 trigger auto-generates onboarding tasks.
  const { error: subErr } = await admin.from('subscriptions').insert({
    client_id: client.id,
    package_id: input.package_id,
    location_id: location.id,
    status: 'active',
    started_at: startedAt,
  })
  if (subErr) {
    await admin.from('clients').delete().eq('id', client.id)
    return err('INTERNAL', `Failed to create subscription: ${subErr.message}`)
  }

  revalidatePath('/admin/clients')
  return ok({ client_id: client.id })
}
