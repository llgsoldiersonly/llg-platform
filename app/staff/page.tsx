import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StaffSubmitForm } from './staff-submit-form'

export const dynamic = 'force-dynamic'

type FirmRow = { id: string; firm_name: string; status: string }
type DeliverableRow = {
  id: string
  client_id: string
  title: string
  module_code: string
  code: string
  period_start: string
  period_end: string
  target_count: number | null
  actual_count: number | null
}
type MyTask = {
  id: string
  task_number: number
  title: string
  status: string
  priority: string
  due_date: string | null
  block_reason: string | null
  client: { firm_name: string } | null
}
type MyDeliverable = {
  id: string
  title: string
  status: string
  client_id: string
  period_end: string
}

type WorkItem = {
  key: string
  title: string
  sub: string
  priority: string | null
  due: string | null
  blockReason?: string | null
}

export default async function StaffHomePage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login?next=/staff')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: firms }, { data: deliverables }, { data: myTasks }, { data: myDeliv }] =
    await Promise.all([
      admin.from('clients').select('id, firm_name, status').neq('status', 'churned').order('firm_name').returns<FirmRow[]>(),
      admin
        .from('deliverables_display')
        .select('id, client_id, title, module_code, code, period_start, period_end, target_count, actual_count')
        .lte('period_start', today)
        .gte('period_end', today)
        .returns<DeliverableRow[]>(),
      admin
        .from('tasks')
        .select('id, task_number, title, status, priority, due_date, block_reason, client:clients(firm_name)')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("done","cancelled")')
        .returns<MyTask[]>(),
      admin
        .from('deliverables_display')
        .select('id, title, status, client_id, period_end')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("done","skipped")')
        .returns<MyDeliverable[]>(),
    ])

  const firmName = new Map((firms ?? []).map((f) => [f.id, f.firm_name]))

  const taskItems: WorkItem[] = (myTasks ?? []).map((t) => ({
    key: `t-${t.id}`,
    title: t.title,
    sub: `#${t.task_number} · ${t.client?.firm_name ?? 'internal'}`,
    priority: t.priority,
    due: t.due_date,
    blockReason: t.status === 'blocked' ? t.block_reason : null,
  }))
  const taskStatus = new Map((myTasks ?? []).map((t) => [`t-${t.id}`, t.status]))

  const delivItems: WorkItem[] = (myDeliv ?? []).map((d) => ({
    key: `d-${d.id}`,
    title: d.title,
    sub: `${firmName.get(d.client_id) ?? 'client'} · deliverable`,
    priority: null,
    due: d.period_end,
    blockReason: null,
  }))
  const delivStatus = new Map((myDeliv ?? []).map((d) => [`d-${d.id}`, d.status]))

  const all = [...taskItems, ...delivItems]
  const statusOf = (i: WorkItem) => taskStatus.get(i.key) ?? delivStatus.get(i.key) ?? ''

  const overdue = all.filter((i) => i.due && i.due < today && statusOf(i) !== 'blocked')
  const dueToday = all.filter((i) => i.due === today && statusOf(i) !== 'blocked')
  const paused = all.filter((i) => statusOf(i) === 'blocked')
  const inReview = all.filter((i) => statusOf(i) === 'in_review')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">My Day</h1>
          <p className="mt-1 text-sm text-body">Your assigned tasks and deliverables at a glance.</p>
        </div>
        <Link href="/staff/board" className="text-sm text-fg-brand hover:underline">
          Open My Work board →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bucket title="Overdue" tone="danger" items={overdue} empty="Nothing overdue 🎉" />
        <Bucket title="Due today" tone="brand" items={dueToday} empty="Nothing due today." />
        <Bucket title="Waiting on you (paused)" tone="muted" items={paused} empty="Nothing paused." showReason />
        <Bucket title="In review" tone="muted" items={inReview} empty="Nothing in review." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit completed work</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffSubmitForm firms={firms ?? []} deliverables={deliverables ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

function Bucket({
  title,
  items,
  empty,
  tone,
  showReason,
}: {
  title: string
  items: WorkItem[]
  empty: string
  tone: 'danger' | 'brand' | 'muted'
  showReason?: boolean
}) {
  const headColor =
    tone === 'danger' ? 'text-fg-danger-strong' : tone === 'brand' ? 'text-fg-brand-strong' : 'text-heading'
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm ${headColor}`}>
          {title} <span className="text-body-subtle">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-body-subtle">{empty}</p>
        ) : (
          items.map((i) => (
            <div key={i.key} className="rounded border border-border-default p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight text-heading">{i.title}</p>
                {(i.priority === 'urgent' || i.priority === 'high') && (
                  <Badge variant="destructive">{i.priority}</Badge>
                )}
              </div>
              <p className="text-xs text-body-subtle">
                {i.sub}
                {i.due && <> · due {i.due}</>}
              </p>
              {showReason && i.blockReason && (
                <p className="mt-1 text-xs text-body">⏸ {i.blockReason}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
