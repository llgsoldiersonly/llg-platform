'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'
import {
  IMPERSONATION_CLIENT_COOKIE,
  IMPERSONATION_LOG_COOKIE,
  getActiveImpersonation,
} from '@/lib/impersonation'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 8, // 8h cap; explicit "Exit" closes the row earlier
}

export async function startImpersonation(formData: FormData): Promise<Result<{ redirectTo: string }>> {
  const clientId = formData.get('client_id')
  const reason = formData.get('reason')
  if (typeof clientId !== 'string' || !clientId) return err('VALIDATION_FAILED', 'Missing client_id')
  if (typeof reason !== 'string' || reason.trim().length < 5) {
    return err('VALIDATION_FAILED', 'Reason must be at least 5 characters')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isSuperAdmin(user)) return err('FORBIDDEN', 'Only super-admins can impersonate clients')

  const admin = createAdminClient()

  const { data: clientRow, error: clientErr } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()
  if (clientErr || !clientRow) return err('NOT_FOUND', 'Client does not exist')

  const { data: logRow, error: insertErr } = await admin
    .from('impersonation_log')
    .insert({
      impersonator_id: user.id,
      impersonated_client_id: clientId,
      reason: reason.trim(),
    })
    .select('id')
    .single()
  if (insertErr || !logRow) {
    return err('INTERNAL', `Failed to record impersonation: ${insertErr?.message ?? 'unknown'}`)
  }

  const jar = await cookies()
  jar.set(IMPERSONATION_CLIENT_COOKIE, clientId, COOKIE_OPTIONS)
  jar.set(IMPERSONATION_LOG_COOKIE, logRow.id, COOKIE_OPTIONS)

  revalidatePath('/', 'layout')
  return ok({ redirectTo: '/overview' })
}

export async function stopImpersonation(): Promise<Result<{ redirectTo: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')

  const active = await getActiveImpersonation()

  if (active) {
    const admin = createAdminClient()
    await admin
      .from('impersonation_log')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', active.logId)
      .is('ended_at', null)
  }

  const jar = await cookies()
  jar.delete(IMPERSONATION_CLIENT_COOKIE)
  jar.delete(IMPERSONATION_LOG_COOKIE)

  const redirectTo = active ? `/admin/clients/${active.clientId}` : '/admin/dashboard'
  revalidatePath('/', 'layout')
  return ok({ redirectTo })
}

// Form-action wrappers — use these as `<form action={...}>` to get a redirect
// without a client component. They throw the redirect itself; callers should
// not wrap in try/catch.
export async function startImpersonationFormAction(formData: FormData) {
  const result = await startImpersonation(formData)
  if (!result.ok) {
    redirect(`/admin/clients/${formData.get('client_id')}?impersonation_error=${encodeURIComponent(result.error.message)}`)
  }
  redirect(result.data.redirectTo)
}

export async function stopImpersonationFormAction() {
  const result = await stopImpersonation()
  redirect(result.ok ? result.data.redirectTo : '/admin/dashboard')
}
