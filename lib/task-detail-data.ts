import { createAdminClient } from '@/lib/supabase/admin'
import type { TaskDetailData, ActivityRow, CommentRow } from '@/components/admin/task-detail'

type RawTask = {
  id: string
  task_number: number
  title: string
  description: string | null
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  block_reason: string | null
  estimated_hours: number | null
  actual_hours: number | null
  assigned_to: string | null
  client: { firm_name: string } | null
  department: { name: string } | null
}

export async function loadTaskDetail(
  id: string
): Promise<{ task: TaskDetailData; activity: ActivityRow[]; comments: CommentRow[] } | null> {
  const supa = createAdminClient()
  const [{ data: task }, { data: activity }, { data: comments }] = await Promise.all([
    supa
      .from('tasks')
      .select(
        'id, task_number, title, description, status, priority, start_date, due_date, block_reason, estimated_hours, actual_hours, assigned_to, client:clients(firm_name), department:departments(name)'
      )
      .eq('id', id)
      .maybeSingle<RawTask>(),
    supa
      .from('activity_log')
      .select('id, action, created_at, actor_id')
      .eq('entity_type', 'task')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<{ id: string; action: string; created_at: string; actor_id: string | null }[]>(),
    supa
      .from('task_comments')
      .select('id, body, created_at, author_id')
      .eq('task_id', id)
      .order('created_at', { ascending: true })
      .returns<{ id: string; body: string; created_at: string; author_id: string | null }[]>(),
  ])

  if (!task) return null

  const ids = new Set<string>()
  if (task.assigned_to) ids.add(task.assigned_to)
  for (const a of activity ?? []) if (a.actor_id) ids.add(a.actor_id)
  for (const c of comments ?? []) if (c.author_id) ids.add(c.author_id)

  const { data: profs } = ids.size
    ? await supa.from('profiles').select('id, full_name').in('id', [...ids]).returns<{ id: string; full_name: string | null }[]>()
    : { data: [] as { id: string; full_name: string | null }[] }
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]))

  return {
    task: {
      id: task.id,
      task_number: task.task_number,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      start_date: task.start_date,
      due_date: task.due_date,
      block_reason: task.block_reason,
      estimated_hours: task.estimated_hours,
      actual_hours: task.actual_hours,
      client: task.client,
      department: task.department,
      assigneeName: task.assigned_to ? nameById.get(task.assigned_to) ?? null : null,
    },
    activity: (activity ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      actorName: a.actor_id ? nameById.get(a.actor_id) ?? null : null,
    })),
    comments: (comments ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      authorName: c.author_id ? nameById.get(c.author_id) ?? null : null,
    })),
  }
}
