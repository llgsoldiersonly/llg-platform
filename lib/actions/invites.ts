'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin, isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

type StaffRole = 'agency_staff' | 'super_admin'

export type InviteStaffInput = {
  email: string
  full_name: string
  role: StaffRole
  department_id?: string | null
  title?: string | null
}

// Invites a new staff user — creates auth.users (magic link sent by Supabase),
// sets app_metadata.role so middleware lets them into /admin, and updates
// the profile row created by the on_auth_user_created trigger.
export async function inviteStaff(input: InviteStaffInput): Promise<Result<{ user_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can invite staff')

  if (!input.email || !input.email.includes('@')) return err('VALIDATION_FAILED', 'Valid email required')
  if (!input.full_name) return err('VALIDATION_FAILED', 'Full name required')
  if (input.role !== 'agency_staff' && input.role !== 'super_admin') {
    return err('VALIDATION_FAILED', 'Invalid role')
  }

  const admin = createAdminClient()

  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { full_name: input.full_name } }
  )
  if (inviteErr || !inviteData.user) {
    return err('INTERNAL', `Invite failed: ${inviteErr?.message ?? 'no user returned'}`)
  }

  const userId = inviteData.user.id

  const { error: roleErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: input.role },
  })
  if (roleErr) {
    return err('INTERNAL', `Invite created but role assignment failed: ${roleErr.message}. User ${userId} needs manual fix.`)
  }

  // Profile row was created by the on_auth_user_created trigger with role
  // defaulted from raw_app_meta_data at insert time — that was empty when
  // the user was just created, so we override here.
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      role: input.role,
      full_name: input.full_name,
      department_id: input.department_id ?? null,
      title: input.title ?? null,
    })
    .eq('id', userId)
  if (profileErr) {
    return err('INTERNAL', `Invite created but profile patch failed: ${profileErr.message}. User ${userId} needs manual fix.`)
  }

  revalidatePath('/admin/settings/users')
  return ok({ user_id: userId })
}

export type InviteClientInput = {
  client_id: string
  email: string
  full_name: string
}

// Invites a client_user, links them to the given client via client_users.
// Used from /admin/clients/[id] to onboard the primary contact.
export async function inviteClientUser(input: InviteClientInput): Promise<Result<{ user_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  if (!input.email || !input.email.includes('@')) return err('VALIDATION_FAILED', 'Valid email required')
  if (!input.client_id) return err('VALIDATION_FAILED', 'Missing client_id')

  const admin = createAdminClient()

  const { data: clientRow } = await admin
    .from('clients')
    .select('id')
    .eq('id', input.client_id)
    .maybeSingle()
  if (!clientRow) return err('NOT_FOUND', 'Client does not exist')

  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { full_name: input.full_name } }
  )
  if (inviteErr || !inviteData.user) {
    return err('INTERNAL', `Invite failed: ${inviteErr?.message ?? 'no user returned'}`)
  }

  const userId = inviteData.user.id

  const { error: roleErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'client_user' },
  })
  if (roleErr) {
    return err('INTERNAL', `Invite created but role assignment failed: ${roleErr.message}. User ${userId} needs manual fix.`)
  }

  const { error: linkErr } = await admin
    .from('client_users')
    .insert({ client_id: input.client_id, user_id: userId, role: 'owner' })
  if (linkErr) {
    return err('INTERNAL', `Failed to link user to client: ${linkErr.message}`)
  }

  const { error: profileErr } = await admin
    .from('profiles')
    .update({ full_name: input.full_name, role: 'client_user' })
    .eq('id', userId)
  if (profileErr) {
    return err('INTERNAL', `Invite created but profile patch failed: ${profileErr.message}. User ${userId} needs manual fix.`)
  }

  revalidatePath(`/admin/clients/${input.client_id}`)
  return ok({ user_id: userId })
}
