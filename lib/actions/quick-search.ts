'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgencyStaff } from '@/lib/auth/rbac'
import { ok, err, type Result } from '@/lib/errors'

export type QuickSearchResult = {
  tasks: { id: string; task_number: number; title: string; status: string; firmName: string | null }[]
  clients: { id: string; firm_name: string; status: string }[]
}

function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
}

// Backs the Cmd+K palette: tasks by title, clients by firm name. Static admin
// pages are matched client-side — this action only covers the data.
export async function quickSearch(q: string): Promise<Result<QuickSearchResult>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED')
  if (!isAgencyStaff(user)) return err('FORBIDDEN')

  const query = q?.trim() ?? ''
  if (query.length < 2) return ok({ tasks: [], clients: [] })

  const admin = createAdminClient()
  const pattern = likePattern(query)

  const [{ data: tasks }, { data: clients }] = await Promise.all([
    admin
      .from('tasks')
      .select('id, task_number, title, status, client:clients(firm_name)')
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<{ id: string; task_number: number; title: string; status: string; client: { firm_name: string } | null }[]>(),
    admin
      .from('clients')
      .select('id, firm_name, status')
      .ilike('firm_name', pattern)
      .order('firm_name')
      .limit(5)
      .returns<{ id: string; firm_name: string; status: string }[]>(),
  ])

  return ok({
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      task_number: t.task_number,
      title: t.title,
      status: t.status,
      firmName: t.client?.firm_name ?? null,
    })),
    clients: clients ?? [],
  })
}
