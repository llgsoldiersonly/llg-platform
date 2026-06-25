'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { normalizeDomain } from '@/lib/integrations/dataforseo/normalize'
import { runPeriodRollover } from '@/lib/deliverables/rollover'
import { ok, err, type Result } from '@/lib/errors'

type ClientStatus = 'prospect' | 'onboarding' | 'active' | 'paused' | 'churned'

const STATUSES: ClientStatus[] = ['prospect', 'onboarding', 'active', 'paused', 'churned']

export type CreateClientInput = {
  firm_name: string
  primary_domain?: string | null
  // Optional second tracked website (e.g. a separate GBP/local site). Recorded
  // in client_sites; domain-driven features fan out to it in a later phase.
  secondary_domain?: string | null
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
  // Subscription. Required for a normal client (the on-insert trigger from
  // migration 0013 generates onboarding tasks; the period-rollover cron
  // materializes deliverables). Optional when is_lead_buyer is true — a
  // lead-buyer client has no package, just downloadable lead PDFs.
  package_id?: string | null
  started_at?: string | null
  // Lead-buyer: skip the package/subscription entirely and turn the Leads box on.
  is_lead_buyer?: boolean
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

  const isLeadBuyer = input.is_lead_buyer ?? false
  if (!isLeadBuyer && !input.package_id) {
    return err('VALIDATION_FAILED', 'A package is required (or mark this as a lead-buyer client)')
  }

  const status: ClientStatus =
    input.status && STATUSES.includes(input.status) ? input.status : 'onboarding'
  const startedAt = trimOrNull(input.started_at) ?? new Date().toISOString().slice(0, 10)

  const admin = createAdminClient()

  // 1. Verify the package exists (skipped for lead-buyer clients with no package).
  if (!isLeadBuyer && input.package_id) {
    const { data: pkg, error: pkgErr } = await admin
      .from('package_templates')
      .select('id')
      .eq('id', input.package_id)
      .maybeSingle()
    if (pkgErr) return err('INTERNAL', `Package lookup failed: ${pkgErr.message}`)
    if (!pkg) return err('VALIDATION_FAILED', 'Selected package does not exist')
  }

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
      leads_enabled: isLeadBuyer,
    })
    .select('id')
    .single()
  if (clientErr || !client) {
    return err('INTERNAL', `Failed to create client: ${clientErr?.message ?? 'no row returned'}`)
  }

  // 2b. Register tracked website(s). The primary site mirrors back into
  // clients.primary_domain via the 0029 trigger, so every existing reader/cron
  // keeps working; an optional secondary can be added now or later.
  const primaryDomain = trimOrNull(input.primary_domain)
  const secondaryDomain = trimOrNull(input.secondary_domain)
  const sitesToInsert: Array<{
    client_id: string
    domain: string
    label: string
    purpose: string
    is_primary: boolean
    is_active: boolean
  }> = []
  if (primaryDomain) {
    sitesToInsert.push({
      client_id: client.id,
      domain: normalizeDomain(primaryDomain),
      label: 'Primary',
      purpose: 'primary',
      is_primary: true,
      is_active: true,
    })
  }
  if (secondaryDomain) {
    sitesToInsert.push({
      client_id: client.id,
      domain: normalizeDomain(secondaryDomain),
      label: 'Secondary',
      purpose: 'secondary',
      is_primary: false,
      is_active: true,
    })
  }
  if (sitesToInsert.length > 0) {
    const { error: sitesErr } = await admin.from('client_sites').insert(sitesToInsert)
    if (sitesErr) {
      await admin.from('clients').delete().eq('id', client.id)
      return err('INTERNAL', `Failed to register sites: ${sitesErr.message}`)
    }
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

  // 4. Insert the subscription (skipped for lead-buyer clients — they have no
  // package). The 0013 trigger auto-generates onboarding tasks for normal clients.
  if (!isLeadBuyer && input.package_id) {
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

    // Materialize this period's deliverables right away so the client isn't empty
    // until the 1st-of-month rollover cron. Best-effort — a hiccup here shouldn't
    // undo a successfully created client; the cron (or the manual button) catches
    // it up.
    try {
      await runPeriodRollover(admin, { clientId: client.id })
    } catch {
      // non-fatal
    }
  }

  revalidatePath('/admin/clients')
  return ok({ client_id: client.id })
}

export type UpdateClientInput = {
  client_id: string
  firm_name?: string
  primary_domain?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  vertical?: string | null
  status?: ClientStatus
  notes?: string | null
}

// Super-admin: edit a client's record (contact details, domain, vertical,
// status, notes). Note: this updates the contact email on the record — it does
// NOT change a portal user's login email (that's an auth-user change).
export async function updateClientDetails(
  input: UpdateClientInput
): Promise<Result<{ client_id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can edit clients')
  if (!input.client_id) return err('VALIDATION_FAILED', 'Missing client id')

  const patch: Record<string, unknown> = {}
  if (input.firm_name !== undefined) {
    const firmName = trimOrNull(input.firm_name)
    if (!firmName) return err('VALIDATION_FAILED', 'Firm name cannot be empty')
    patch.firm_name = firmName
  }
  if (input.primary_domain !== undefined) patch.primary_domain = trimOrNull(input.primary_domain)
  if (input.primary_contact_name !== undefined)
    patch.primary_contact_name = trimOrNull(input.primary_contact_name)
  if (input.primary_contact_email !== undefined) {
    const email = trimOrNull(input.primary_contact_email)
    if (email && !email.includes('@')) return err('VALIDATION_FAILED', 'Enter a valid contact email')
    patch.primary_contact_email = email
  }
  if (input.primary_contact_phone !== undefined)
    patch.primary_contact_phone = trimOrNull(input.primary_contact_phone)
  if (input.vertical !== undefined) patch.vertical = trimOrNull(input.vertical)
  if (input.status !== undefined && STATUSES.includes(input.status)) patch.status = input.status
  if (input.notes !== undefined) patch.notes = trimOrNull(input.notes)

  if (Object.keys(patch).length === 0) return ok({ client_id: input.client_id })

  const admin = createAdminClient()
  const { error } = await admin.from('clients').update(patch).eq('id', input.client_id)
  if (error) return err('INTERNAL', `Failed to update client: ${error.message}`)

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ client_id: input.client_id })
}

// Super-admin: materialize the current period's package deliverables for one
// client on demand. Backs the "Generate deliverables now" button so a
// mid-month signup doesn't have to wait for the monthly rollover cron.
export async function generateDeliverablesForClient(
  clientId: string
): Promise<Result<{ created: number; skipped: number }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can generate deliverables')
  if (!clientId) return err('VALIDATION_FAILED', 'Missing client id')

  const admin = createAdminClient()
  try {
    const res = await runPeriodRollover(admin, { clientId })
    revalidatePath(`/admin/clients/${clientId}/deliverables`)
    revalidatePath(`/admin/clients/${clientId}`)
    return ok({ created: res.created, skipped: res.skipped })
  } catch (e) {
    return err('INTERNAL', e instanceof Error ? e.message : 'rollover failed')
  }
}
