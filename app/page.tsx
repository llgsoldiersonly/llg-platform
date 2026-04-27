import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role as string | undefined) ?? null
  if (role === 'agency_staff' || role === 'super_admin') {
    redirect('/dashboard')
  }
  redirect('/overview')
}
