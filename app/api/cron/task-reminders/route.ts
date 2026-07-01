import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Cron: daily 13:00 UTC (~morning US). Nudges each assignee about their open
// tasks that are due today or already overdue, via an in-app notification
// (surfaces in the bell). One reminder per task per day — deduped against
// notifications already written today so a re-run doesn't double-notify.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const startOfDay = `${today}T00:00:00.000Z`

  const { data: tasks } = await supa
    .from('tasks')
    .select('id, task_number, title, due_date, assigned_to')
    .not('assigned_to', 'is', null)
    .not('due_date', 'is', null)
    .lte('due_date', today)
    .not('status', 'in', '("done","cancelled")')
    .returns<{ id: string; task_number: number; title: string; due_date: string; assigned_to: string }[]>()

  const candidates = tasks ?? []
  if (candidates.length === 0) {
    await supa.from('sync_log').insert({ source: 'cron:task-reminders', status: 'ok', row_count: 0 })
    return NextResponse.json({ ok: true, notified: 0 })
  }

  // Resolve each assignee's portal so the deep link points at the right side.
  const assigneeIds = Array.from(new Set(candidates.map((t) => t.assigned_to)))
  const { data: profiles } = await supa
    .from('profiles')
    .select('id, role')
    .in('id', assigneeIds)
    .returns<{ id: string; role: string | null }[]>()
  const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role]))
  const linkFor = (userId: string, taskId: string) =>
    roleById.get(userId) === 'agency_staff' ? `/staff/tasks/${taskId}` : `/admin/tasks/${taskId}`

  // Dedup: any task that already got a reminder today (link contains task id).
  const { data: sentToday } = await supa
    .from('notifications')
    .select('link')
    .eq('type', 'task_reminder')
    .gte('created_at', startOfDay)
    .returns<{ link: string | null }[]>()
  const alreadySent = new Set((sentToday ?? []).map((n) => n.link))

  const rows = candidates
    .map((t) => {
      const link = linkFor(t.assigned_to, t.id)
      const overdue = t.due_date < today
      return {
        user_id: t.assigned_to,
        type: 'task_reminder',
        subject: overdue ? `Overdue: ${t.title}` : `Due today: ${t.title}`,
        body: `Task #${t.task_number} is ${overdue ? `overdue (was due ${t.due_date})` : 'due today'}.`,
        link,
      }
    })
    .filter((r) => !alreadySent.has(r.link))

  if (rows.length === 0) {
    await supa.from('sync_log').insert({ source: 'cron:task-reminders', status: 'ok', row_count: 0 })
    return NextResponse.json({ ok: true, notified: 0 })
  }

  const { error } = await supa.from('notifications').insert(rows)
  if (error) {
    await supa.from('sync_log').insert({
      source: 'cron:task-reminders',
      status: 'error',
      error_message: error.message,
    })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await supa.from('sync_log').insert({ source: 'cron:task-reminders', status: 'ok', row_count: rows.length })
  return NextResponse.json({ ok: true, notified: rows.length })
}

export const GET = POST
