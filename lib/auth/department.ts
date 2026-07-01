import type { createAdminClient } from '@/lib/supabase/admin'

// Department-lead scoping. A lead is an agency_staff user with
// profiles.is_department_lead = true, scoped to their profiles.department_id.
// Kept out of rbac.ts because it needs a DB lookup (the JWT only carries role),
// whereas rbac.ts helpers are pure functions over the auth user.

export type LeadScope = { isLead: boolean; departmentId: string | null }

export async function getLeadScope(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<LeadScope> {
  const { data } = await admin
    .from('profiles')
    .select('is_department_lead, department_id')
    .eq('id', userId)
    .maybeSingle<{ is_department_lead: boolean; department_id: string | null }>()
  return { isLead: !!data?.is_department_lead, departmentId: data?.department_id ?? null }
}

// True when this lead may manage work in the given department.
export function canManageDept(scope: LeadScope, departmentId: string | null): boolean {
  return scope.isLead && !!scope.departmentId && departmentId === scope.departmentId
}
