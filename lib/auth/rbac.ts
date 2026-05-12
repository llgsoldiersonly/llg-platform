import type { User } from '@supabase/supabase-js'

export type UserRole = 'agency_staff' | 'client_user' | 'super_admin'

export function getRole(user: User | null): UserRole | null {
  if (!user) return null
  const role = user.app_metadata?.role as UserRole | undefined
  return role ?? null
}

export function isAgencyStaff(user: User | null): boolean {
  const role = getRole(user)
  return role === 'agency_staff' || role === 'super_admin'
}

export function isClientUser(user: User | null): boolean {
  return getRole(user) === 'client_user'
}

export function isSuperAdmin(user: User | null): boolean {
  return getRole(user) === 'super_admin'
}

export function canApproveSubmissions(user: User | null): boolean {
  return isSuperAdmin(user)
}
