import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/integrations/resend'

// Cron: daily 11:45 UTC (~morning US). Two jobs in one pass:
//
//  1. Per-staffer digest — overdue tasks, tasks due today, and the last 24h of
//     mentions / assignments / step-ready pings, emailed to each active staff
//     member. Staffers with nothing to report get no email.
//  2. Whole-team summary — submissions, completed tasks, overdue and paused
//     work across the team (with a per-person rollup), emailed to
//     platform_settings.daily_summary_email (null disables it).
//
// Requires RESEND_API_KEY. Links point at NEXT_PUBLIC_SITE_URL
// (default https://llgportal.com).

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://llgportal.com'

type TaskRow = {
  id: string
  task_number: number
  title: string
  status: string
  due_date: string | null
  block_reason: string | null
  assigned_to: string | null
  completed_at: string | null
  parent_task_id: string | null
  client: { firm_name: string } | null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function taskLine(t: TaskRow, extra?: string): string {
  const firm = t.client?.firm_name ? ` · ${esc(t.client.firm_name)}` : ''
  return `<li style="margin:4px 0">#${t.task_number} ${esc(t.title)}${firm}${extra ?? ''}</li>`
}

function section(title: string, inner: string): string {
  return `<h3 style="margin:18px 0 6px;font-size:14px;color:#111">${esc(title)}</h3>${inner}`
}

function wrap(heading: string, body: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;max-width:640px">
    <h2 style="font-size:17px;color:#111;margin:0 0 4px">${esc(heading)}</h2>
    <p style="margin:0 0 10px;color:#777;font-size:12px">Legal Leads Group portal · <a href="${BASE}" style="color:#6d28d9">llgportal.com</a></p>
    ${body}
  </div>`
}

export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  if (!process.env.RESEND_API_KEY) {
    await supa.from('sync_log').insert({
      source: 'cron:email-digests',
      status: 'error',
      error_message: 'RESEND_API_KEY is not configured',
    })
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  const [{ data: staff }, usersRes, { data: openTasks }, { data: recentDone }, { data: settings }] =
    await Promise.all([
      supa
        .from('profiles')
        .select('id, full_name, role, is_active')
        .in('role', ['agency_staff', 'super_admin'])
        .eq('is_active', true)
        .returns<{ id: string; full_name: string | null; role: string; is_active: boolean }[]>(),
      supa.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supa
        .from('tasks')
        .select('id, task_number, title, status, due_date, block_reason, assigned_to, completed_at, parent_task_id, client:clients(firm_name)')
        .not('status', 'in', '("done","cancelled")')
        .returns<TaskRow[]>(),
      supa
        .from('tasks')
        .select('id, task_number, title, status, due_date, block_reason, assigned_to, completed_at, parent_task_id, client:clients(firm_name)')
        .eq('status', 'done')
        .gte('completed_at', since)
        .returns<TaskRow[]>(),
      supa
        .from('platform_settings')
        .select('daily_summary_email')
        .eq('id', 1)
        .maybeSingle<{ daily_summary_email: string | null }>(),
    ])

  const emailById = new Map<string, string>()
  for (const u of usersRes.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }
  const nameById = new Map((staff ?? []).map((p) => [p.id, p.full_name ?? 'Unnamed']))

  let sent = 0
  const errors: string[] = []

  // ---- 1. Per-staffer digests -------------------------------------------
  for (const person of staff ?? []) {
    const email = emailById.get(person.id)
    if (!email) continue

    const mine = (openTasks ?? []).filter((t) => t.assigned_to === person.id)
    const overdue = mine.filter((t) => t.due_date && t.due_date < today && t.status !== 'blocked')
    const dueToday = mine.filter((t) => t.due_date === today && t.status !== 'blocked')

    const { data: pings } = await supa
      .from('notifications')
      .select('subject, created_at')
      .eq('user_id', person.id)
      .in('type', ['mention', 'task_assigned', 'step_ready'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<{ subject: string; created_at: string }[]>()

    if (overdue.length === 0 && dueToday.length === 0 && (pings ?? []).length === 0) continue

    const portal = person.role === 'agency_staff' ? `${BASE}/staff` : `${BASE}/admin/tasks/board`
    const parts: string[] = []
    if (overdue.length > 0) {
      parts.push(section(`Overdue (${overdue.length})`, `<ul style="margin:0;padding-left:18px;color:#b91c1c">${overdue.map((t) => taskLine(t, ` — due ${t.due_date}`)).join('')}</ul>`))
    }
    if (dueToday.length > 0) {
      parts.push(section(`Due today (${dueToday.length})`, `<ul style="margin:0;padding-left:18px">${dueToday.map((t) => taskLine(t)).join('')}</ul>`))
    }
    if ((pings ?? []).length > 0) {
      parts.push(section(`New for you (last 24h)`, `<ul style="margin:0;padding-left:18px">${(pings ?? []).map((n) => `<li style="margin:4px 0">${esc(n.subject)}</li>`).join('')}</ul>`))
    }
    parts.push(`<p style="margin:16px 0 0"><a href="${portal}" style="color:#6d28d9">Open your board →</a></p>`)

    const res = await sendEmail(
      email,
      `Your day: ${overdue.length} overdue · ${dueToday.length} due today`,
      wrap(`Good morning, ${person.full_name ?? 'there'}`, parts.join(''))
    )
    if (res.ok) sent++
    else errors.push(`${email}: ${res.error}`)
  }

  // ---- 2. Whole-team summary ---------------------------------------------
  const summaryTo = settings?.daily_summary_email?.trim() || null
  if (summaryTo) {
    const [{ data: submissions }, { data: firms }] = await Promise.all([
      supa
        .from('deliverable_submissions')
        .select('id, kind, link_url, client_id, submitted_by, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .returns<{ id: string; kind: string; link_url: string | null; client_id: string; submitted_by: string | null; created_at: string }[]>(),
      supa.from('clients').select('id, firm_name').returns<{ id: string; firm_name: string }[]>(),
    ])
    const firmById = new Map((firms ?? []).map((f) => [f.id, f.firm_name]))

    const overdueAll = (openTasks ?? []).filter((t) => t.due_date && t.due_date < today && t.status !== 'blocked')
    const pausedAll = (openTasks ?? []).filter((t) => t.status === 'blocked')

    // Per-person rollup: submissions + completed tasks in the window.
    const perPerson = new Map<string, { subs: number; done: number }>()
    const bump = (id: string | null, key: 'subs' | 'done') => {
      if (!id) return
      const row = perPerson.get(id) ?? { subs: 0, done: 0 }
      row[key]++
      perPerson.set(id, row)
    }
    for (const s of submissions ?? []) bump(s.submitted_by, 'subs')
    for (const t of recentDone ?? []) bump(t.assigned_to, 'done')

    const subsHtml =
      (submissions ?? []).length === 0
        ? '<p style="margin:0;color:#777">No submissions in the last 24 hours.</p>'
        : `<ul style="margin:0;padding-left:18px">${(submissions ?? [])
            .map((s) => {
              const who = s.submitted_by ? nameById.get(s.submitted_by) ?? 'Staff' : 'Staff'
              const link = s.link_url ? ` — <a href="${esc(s.link_url)}" style="color:#6d28d9">link</a>` : ''
              return `<li style="margin:4px 0">${esc(s.kind)} · ${esc(firmById.get(s.client_id) ?? 'client')} · ${esc(who)}${link}</li>`
            })
            .join('')}</ul>`

    const doneHtml =
      (recentDone ?? []).length === 0
        ? '<p style="margin:0;color:#777">No tasks completed in the last 24 hours.</p>'
        : `<ul style="margin:0;padding-left:18px">${(recentDone ?? [])
            .map((t) => taskLine(t, t.assigned_to ? ` — ${esc(nameById.get(t.assigned_to) ?? 'Staff')}` : ''))
            .join('')}</ul>`

    const rollupHtml =
      perPerson.size === 0
        ? ''
        : section(
            'By person (last 24h)',
            `<table style="border-collapse:collapse;font-size:13px">${Array.from(perPerson.entries())
              .map(
                ([id, r]) =>
                  `<tr><td style="padding:2px 14px 2px 0">${esc(nameById.get(id) ?? 'Staff')}</td><td style="padding:2px 14px 2px 0">${r.subs} submission${r.subs === 1 ? '' : 's'}</td><td>${r.done} task${r.done === 1 ? '' : 's'} completed</td></tr>`
              )
              .join('')}</table>`
          )

    const body = [
      section(`Submissions (${(submissions ?? []).length})`, subsHtml),
      section(`Tasks completed (${(recentDone ?? []).length})`, doneHtml),
      rollupHtml,
      section(
        `Overdue (${overdueAll.length})`,
        overdueAll.length === 0
          ? '<p style="margin:0;color:#777">Nothing overdue 🎉</p>'
          : `<ul style="margin:0;padding-left:18px;color:#b91c1c">${overdueAll
              .slice(0, 20)
              .map((t) => taskLine(t, `${t.assigned_to ? ` — ${esc(nameById.get(t.assigned_to) ?? 'Staff')}` : ' — unassigned'} · due ${t.due_date}`))
              .join('')}${overdueAll.length > 20 ? `<li>…and ${overdueAll.length - 20} more</li>` : ''}</ul>`
      ),
      pausedAll.length > 0
        ? section(
            `Paused (${pausedAll.length})`,
            `<ul style="margin:0;padding-left:18px">${pausedAll
              .map((t) => taskLine(t, t.block_reason ? ` — ⏸ ${esc(t.block_reason)}` : ''))
              .join('')}</ul>`
          )
        : '',
      `<p style="margin:16px 0 0"><a href="${BASE}/admin/tasks/board" style="color:#6d28d9">Open the task board →</a></p>`,
    ].join('')

    const res = await sendEmail(
      summaryTo,
      `LLG daily summary — ${(submissions ?? []).length} submissions · ${(recentDone ?? []).length} completed · ${overdueAll.length} overdue`,
      wrap(`Team summary for ${today}`, body)
    )
    if (res.ok) sent++
    else errors.push(`${summaryTo}: ${res.error}`)
  }

  await supa.from('sync_log').insert({
    source: 'cron:email-digests',
    status: errors.length === 0 ? 'ok' : 'error',
    row_count: sent,
    error_message: errors.length > 0 ? errors.join(' | ').slice(0, 500) : null,
  })

  return NextResponse.json({ ok: errors.length === 0, sent, errors })
}

export const GET = POST
