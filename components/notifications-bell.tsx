import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotificationsMenu, type NotificationItem } from './notifications-menu'

// Server wrapper: loads the current user's recent notifications + unread count,
// then hands off to the client dropdown. Used in the staff header and admin bar.
export async function NotificationsBell() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: items }, { count }] = await Promise.all([
    admin
      .from('notifications')
      .select('id, type, subject, body, link, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<NotificationItem[]>(),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  return <NotificationsMenu items={items ?? []} unread={count ?? 0} />
}
