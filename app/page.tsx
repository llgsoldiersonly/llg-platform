import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  redirect(isAgencyStaff(user) ? '/admin/dashboard' : '/overview')
}
