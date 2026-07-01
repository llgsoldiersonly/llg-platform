import type { createAdminClient } from '@/lib/supabase/admin'

// Apply a task template's steps as subtasks under a parent task. Shared by the
// task-detail "apply template" action and content-plan task spawning, so it
// lives in a plain module (not a 'use server' file, whose exports would all
// become RPC endpoints). Returns count created, or -1 on error. Subtasks
// inherit the parent's client + department unless a step names its own.
export async function applyTemplateWithAdmin(
  admin: ReturnType<typeof createAdminClient>,
  taskId: string,
  templateId: string,
  createdBy: string
): Promise<number> {
  const [{ data: parent }, { data: steps }] = await Promise.all([
    admin
      .from('tasks')
      .select('client_id, department_id')
      .eq('id', taskId)
      .maybeSingle<{ client_id: string | null; department_id: string | null }>(),
    admin
      .from('task_template_steps')
      .select('position, title, department_id')
      .eq('template_id', templateId)
      .order('position')
      .returns<{ position: number; title: string; department_id: string | null }[]>(),
  ])
  if (!parent || !steps?.length) return 0

  const rows = steps.map((s) => ({
    title: s.title,
    parent_task_id: taskId,
    position: s.position,
    client_id: parent.client_id,
    department_id: s.department_id ?? parent.department_id,
    status: 'todo',
    priority: 'medium',
    created_by: createdBy,
  }))
  const { error } = await admin.from('tasks').insert(rows)
  return error ? -1 : rows.length
}
