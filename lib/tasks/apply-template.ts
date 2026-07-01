import type { createAdminClient } from '@/lib/supabase/admin'

// Apply a task template's steps as subtasks under a parent task. Shared by the
// task-detail "apply template" action and content-plan task spawning, so it
// lives in a plain module (not a 'use server' file, whose exports would all
// become RPC endpoints). Returns count created, or -1 on error.
//
// Steps resolve their own assignee (via assignee_rule) and due date (via
// offset_days from the parent's start date, else today), so a template
// produces a pipeline that is already assigned and scheduled. Only the FIRST
// pending step's assignee is notified here — later steps get pinged by the
// handoff in updateTaskStatus when the previous step completes, so nobody is
// spammed about work that isn't ready yet.
export async function applyTemplateWithAdmin(
  admin: ReturnType<typeof createAdminClient>,
  taskId: string,
  templateId: string,
  createdBy: string
): Promise<number> {
  const [{ data: parent }, { data: steps }] = await Promise.all([
    admin
      .from('tasks')
      .select('title, client_id, department_id, assigned_to, start_date')
      .eq('id', taskId)
      .maybeSingle<{
        title: string
        client_id: string | null
        department_id: string | null
        assigned_to: string | null
        start_date: string | null
      }>(),
    admin
      .from('task_template_steps')
      .select('position, title, department_id, assignee_rule, assignee_id, offset_days')
      .eq('template_id', templateId)
      .order('position')
      .returns<{
        position: number
        title: string
        department_id: string | null
        assignee_rule: string | null
        assignee_id: string | null
        offset_days: number | null
      }[]>(),
  ])
  if (!parent || !steps?.length) return 0

  // Resolve department leads once per department referenced by the steps.
  const leadDeptIds = Array.from(
    new Set(
      steps
        .filter((s) => s.assignee_rule === 'department_lead')
        .map((s) => s.department_id ?? parent.department_id)
        .filter((d): d is string => !!d)
    )
  )
  const leadByDept = new Map<string, string>()
  if (leadDeptIds.length > 0) {
    const { data: leads } = await admin
      .from('profiles')
      .select('id, department_id')
      .eq('is_department_lead', true)
      .eq('is_active', true)
      .in('department_id', leadDeptIds)
      .returns<{ id: string; department_id: string }[]>()
    for (const l of leads ?? []) {
      if (!leadByDept.has(l.department_id)) leadByDept.set(l.department_id, l.id)
    }
  }

  const base = parent.start_date ? new Date(`${parent.start_date}T00:00:00Z`) : new Date()
  const dueFor = (offset: number | null): string | null => {
    if (offset == null) return null
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const assigneeFor = (s: (typeof steps)[number]): string | null => {
    switch (s.assignee_rule) {
      case 'parent_assignee': return parent.assigned_to
      case 'department_lead': {
        const dept = s.department_id ?? parent.department_id
        return dept ? leadByDept.get(dept) ?? null : null
      }
      case 'specific': return s.assignee_id
      default: return null
    }
  }

  const rows = steps.map((s) => ({
    title: s.title,
    parent_task_id: taskId,
    position: s.position,
    client_id: parent.client_id,
    department_id: s.department_id ?? parent.department_id,
    assigned_to: assigneeFor(s),
    due_date: dueFor(s.offset_days),
    status: 'todo',
    priority: 'medium',
    created_by: createdBy,
  }))
  const { data: inserted, error } = await admin
    .from('tasks')
    .insert(rows)
    .select('id, position, assigned_to')
    .returns<{ id: string; position: number; assigned_to: string | null }[]>()
  if (error) return -1

  // Kick off the pipeline: ping only the first step's assignee.
  const first = (inserted ?? []).sort((a, b) => a.position - b.position).find((r) => r.assigned_to)
  if (first?.assigned_to && first.assigned_to !== createdBy) {
    const step = rows.find((r) => r.position === first.position)
    const { data: prof } = await admin
      .from('profiles')
      .select('role')
      .eq('id', first.assigned_to)
      .maybeSingle<{ role: string | null }>()
    const link = prof?.role === 'agency_staff' ? `/staff/tasks/${first.id}` : `/admin/tasks/${first.id}`
    await admin.from('notifications').insert({
      user_id: first.assigned_to,
      type: 'task_assigned',
      subject: `Your step is ready: ${step?.title ?? 'first step'}`,
      body: `Workflow started on "${parent.title}".`,
      link,
    })
  }

  return rows.length
}
