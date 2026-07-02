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

export type UpdateStaffInput = {
  user_id: string
  full_name?: string | null
  role?: StaffRole
  department_id?: string | null
  title?: string | null
  is_active?: boolean
  is_department_lead?: boolean
  weekly_capacity_hours?: number | null
}

// Edits an existing staff member (department / title / role / active). A role
// change must update BOTH auth.app_metadata.role (middleware reads it for
// access) AND profiles.role, so they don't drift.
export async function updateStaffMember(input: UpdateStaffInput): Promise<Result<{ user_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can edit staff')
  if (!input.user_id) return err('VALIDATION_FAILED', 'Missing user id')

  const admin = createAdminClient()

  if (input.role !== undefined) {
    if (input.role !== 'agency_staff' && input.role !== 'super_admin') {
      return err('VALIDATION_FAILED', 'Invalid role')
    }
    const { error: roleErr } = await admin.auth.admin.updateUserById(input.user_id, {
      app_metadata: { role: input.role },
    })
    if (roleErr) return err('INTERNAL', `Role update failed: ${roleErr.message}`)
  }

  const patch: Record<string, unknown> = {}
  if (input.full_name !== undefined) patch.full_name = input.full_name?.trim() || null
  if (input.role !== undefined) patch.role = input.role
  if (input.department_id !== undefined) patch.department_id = input.department_id || null
  if (input.title !== undefined) patch.title = input.title?.trim() || null
  if (input.is_department_lead !== undefined) patch.is_department_lead = input.is_department_lead
  if (input.weekly_capacity_hours !== undefined) {
    patch.weekly_capacity_hours =
      input.weekly_capacity_hours != null &&
      Number.isFinite(input.weekly_capacity_hours) &&
      input.weekly_capacity_hours > 0
        ? input.weekly_capacity_hours
        : 40
  }

  if (Object.keys(patch).length > 0) {
    const { error: profileErr } = await admin.from('profiles').update(patch).eq('id', input.user_id)
    if (profileErr) return err('INTERNAL', `Profile update failed: ${profileErr.message}`)
  }

  // Active state is handled through the same ban/unban + reassign path as the
  // dedicated Activate/Deactivate control, so the two never drift.
  if (input.is_active !== undefined) {
    const res = await applyActiveState(admin, input.user_id, input.is_active)
    if (!res.ok) return res
  }

  revalidatePath('/admin/settings/users')
  return ok({ user_id: input.user_id })
}

// Long ban == effectively locked out. Supabase has no "disabled" flag, so a
// far-future ban_duration is how we block a deactivated user from logging in.
const LOCK_BAN_DURATION = '876000h' // ~100 years

// Centralized active/inactive transition:
//  - flips profiles.is_active
//  - bans (deactivate) or unbans (reactivate) the auth user so login is gated
//  - on deactivate, unassigns their still-open tasks + deliverables so nothing
//    is stranded on a person who can't act on it (history stays intact).
async function applyActiveState(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  active: boolean
): Promise<Result<{ user_id: string }>> {
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (profileErr) return err('INTERNAL', `Failed to set active state: ${profileErr.message}`)

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : LOCK_BAN_DURATION,
  })
  if (banErr) return err('INTERNAL', `Active state saved, but login gate update failed: ${banErr.message}`)

  if (!active) {
    const now = new Date().toISOString()
    await admin
      .from('tasks')
      .update({ assigned_to: null, updated_at: now })
      .eq('assigned_to', userId)
      .not('status', 'in', '("done","cancelled")')
    await admin
      .from('deliverables')
      .update({ assigned_to: null, updated_at: now })
      .eq('assigned_to', userId)
      .not('status', 'in', '("done","skipped")')
  }

  return ok({ user_id: userId })
}

// Guard: the last active super-admin can't be locked out / removed, or nobody
// can administer the platform. Returns an error Result if `userId` is that
// person, otherwise null.
async function blockIfLastSuperAdmin(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<Result<never> | null> {
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>()
  if (target?.role !== 'super_admin') return null

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'super_admin')
    .eq('is_active', true)
  if ((count ?? 0) <= 1) {
    return err('VALIDATION_FAILED', 'This is the last active super-admin — promote someone else first.')
  }
  return null
}

// Deactivate (soft) or reactivate a staff member. Deactivating hides them from
// pickers, blocks their login, and unassigns their open work; reactivating
// restores login. History is preserved either way.
export async function setStaffActive(
  userId: string,
  active: boolean
): Promise<Result<{ user_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can change staff status')
  if (!userId) return err('VALIDATION_FAILED', 'Missing user id')
  if (userId === user.id) return err('VALIDATION_FAILED', "You can't deactivate your own account.")

  const admin = createAdminClient()

  if (!active) {
    const guard = await blockIfLastSuperAdmin(admin, userId)
    if (guard) return guard
  }

  const res = await applyActiveState(admin, userId, active)
  if (!res.ok) return res

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'user',
    entity_id: userId,
    action: active ? 'reactivated' : 'deactivated',
  })

  revalidatePath('/admin/settings/users')
  return ok({ user_id: userId })
}

// Hard-delete a staff user — ONLY allowed when the account has no history
// (never assigned/created a task, submitted work, commented, or logged
// activity). Anything with history must be deactivated instead so attribution
// and audit trails survive. Direct FK references to auth.users would also block
// the delete at the DB level, so this gate is both UX and correctness.
export async function deleteStaffMember(userId: string): Promise<Result<{ user_id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can delete users')
  if (!userId) return err('VALIDATION_FAILED', 'Missing user id')
  if (userId === user.id) return err('VALIDATION_FAILED', "You can't delete your own account.")

  const admin = createAdminClient()

  const guard = await blockIfLastSuperAdmin(admin, userId)
  if (guard) return guard

  // Existence checks across every table that references the user. A missing
  // table (migration not yet applied) errors rather than throws — we treat
  // that as "no rows" since the table can't hold references yet.
  const activityCount = await countUserActivity(admin, userId)
  if (activityCount > 0) {
    return err(
      'VALIDATION_FAILED',
      'This user has activity (tasks, submissions, or comments). Deactivate them instead — deleting would erase attribution.'
    )
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) {
    return err(
      'INTERNAL',
      `Delete failed: ${delErr.message}. If they have any linked records, deactivate instead.`
    )
  }

  await admin.from('activity_log').insert({
    actor_id: user.id,
    entity_type: 'user',
    entity_id: userId,
    action: 'deleted',
  })

  revalidatePath('/admin/settings/users')
  return ok({ user_id: userId })
}

// Sums references to a user across activity-bearing tables. Any table that
// doesn't exist yet (owed migration) contributes 0.
async function countUserActivity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<number> {
  const head = { count: 'exact' as const, head: true }
  const checks = await Promise.all([
    admin.from('tasks').select('id', head).or(`created_by.eq.${userId},assigned_to.eq.${userId}`),
    admin.from('deliverable_submissions').select('id', head).eq('submitted_by', userId),
    admin.from('deliverables').select('id', head).or(`assigned_to.eq.${userId},completed_by.eq.${userId}`),
    admin.from('task_comments').select('id', head).eq('author_id', userId),
    admin.from('activity_log').select('id', head).eq('actor_id', userId),
    admin.from('client_assets').select('id', head).eq('uploaded_by', userId),
    admin.from('client_lead_files').select('id', head).eq('uploaded_by', userId),
  ])
  return checks.reduce((sum, c) => sum + (c.count ?? 0), 0)
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
