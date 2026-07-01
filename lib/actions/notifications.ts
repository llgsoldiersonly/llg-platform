'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ok, err, type Result } from '@/lib/errors'

// Marks one notification read (only the caller's own).
export async function markNotificationRead(id: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!id) return err('VALIDATION_FAILED', 'Missing id')

  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return err('INTERNAL', error.message)

  revalidatePath('/staff')
  return ok({ id })
}

export async function markAllNotificationsRead(): Promise<Result<{ ok: true }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')

  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return err('INTERNAL', error.message)

  revalidatePath('/staff')
  return ok({ ok: true })
}
