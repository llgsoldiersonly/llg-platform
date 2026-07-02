import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StaffSubmitForm } from './staff-submit-form'
import { WorkItemQuickActions } from './work-item-quick-actions'
import { isValidSubmissionKind } from '@/lib/submissions/kinds'

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
  kind: 'task' | 'deliverable'
  id: string
  status: string
  title: string
  sub: string
  priority: string | null
  due: string | null
  blockReason?: string | null
  href?: string
}

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export default async function StaffHomePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; kind?: string; deliverable?: string }>
}) {
  const sp = await searchParams
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
    kind: 'task' as const,
    id: t.id,
    status: t.status,
    title: t.title,
    sub: `#${t.task_number} · ${t.client?.firm_name ?? 'internal'}`,
    priority: t.priority,
    due: t.due_date,
    blockReason: t.status === 'blocked' ? t.block_reason : null,
    href: `/staff/tasks/${t.id}`,
  }))

  const delivItems: WorkItem[] = (myDeliv ?? []).map((d) => ({
    key: `d-${d.id}`,
    kind: 'deliverable' as const,
    id: d.id,
    status: d.status,
    title: d.title,
    sub: `${firmName.get(d.client_id) ?? 'client'} · deliverable`,
    priority: null,
    due: d.period_end,
    blockReason: null,
  }))

  const all = [...taskItems, ...delivItems]

  const overdue = all.filter((i) => i.due && i.due < today && i.status !== 'blocked')
  const dueToday = all.filter((i) => i.due === today && i.status !== 'blocked')
  const paused = all.filter((i) => i.status === 'blocked')
  const inReview = all.filter((i) => i.status === 'in_review')

  // "Next up": the top 3 actionable items — overdue first, then earliest due,
  // then priority. Excludes paused (waiting on something) and in-review
  // (waiting on someone else).
  const actionable = all.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'pending')
  const nextUp = [...actionable]
    .sort((a, b) => {
      const aOver = a.due && a.due < today ? 0 : 1
      const bOver = b.due && b.due < today ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const aDue = a.due ?? '9999-12-31'
      const bDue = b.due ?? '9999-12-31'
      if (aDue !== bDue) return aDue < bDue ? -1 : 1
      return (PRIORITY_WEIGHT[a.priority ?? 'medium'] ?? 2) - (PRIORITY_WEIGHT[b.priority ?? 'medium'] ?? 2)
    })
    .slice(0, 3)

  // Prefill for the submit form (deep-linked from a task's "Submit work").
  const initialClientId = sp.client && firmName.has(sp.client) ? sp.client : undefined
  const initialKind = sp.kind && isValidSubmissionKind(sp.kind) ? sp.kind : undefined
  const initialDeliverableId = sp.deliverable || undefined

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

      {nextUp.length > 0 && (
        <Card className="border-border-brand/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-fg-brand-strong">Next up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextUp.map((i, idx) => (
              <ItemCard key={i.key} item={i} highlight={idx === 0} today={today} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Bucket title="Overdue" tone="danger" items={overdue} empty="Nothing overdue 🎉" today={today} />
        <Bucket title="Due today" tone="brand" items={dueToday} empty="Nothing due today." today={today} />
        <Bucket title="Waiting on you (paused)" tone="muted" items={paused} empty="Nothing paused." showReason today={today} />
        <Bucket title="In review" tone="muted" items={inReview} empty="Nothing in review." today={today} />
      </div>

      <div id="submit">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit completed work</CardTitle>
          </CardHeader>
          <CardContent>
            <StaffSubmitForm
              firms={firms ?? []}
              deliverables={deliverables ?? []}
              initialClientId={initialClientId}
              initialKind={initialKind}
              initialDeliverableId={initialDeliverableId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ItemCard({
  item,
  highlight = false,
  showReason = false,
  today,
}: {
  item: WorkItem
  highlight?: boolean
  showReason?: boolean
  today: string
}) {
  const isOverdue = !!item.due && item.due < today
  return (
    <div
      className={`rounded border p-2.5 ${
        highlight ? 'border-border-brand bg-brand-soft/30' : 'border-border-default'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {item.href ? (
          <Link href={item.href} className="font-medium leading-tight text-heading hover:text-fg-brand hover:underline">
            {item.title}
          </Link>
        ) : (
          <p className="font-medium leading-tight text-heading">{item.title}</p>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {highlight && <Badge variant="warning">Do this first</Badge>}
          {(item.priority === 'urgent' || item.priority === 'high') && (
            <Badge variant="destructive">{item.priority}</Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-body-subtle">
        {item.sub}
        {item.due && (
          <>
            {' '}· <span className={isOverdue ? 'font-medium text-fg-danger-strong' : ''}>due {item.due}</span>
          </>
        )}
      </p>
      {showReason && item.blockReason && <p className="mt-1 text-xs text-body">⏸ {item.blockReason}</p>}
      <WorkItemQuickActions kind={item.kind} id={item.id} status={item.status} />
    </div>
  )
}

function Bucket({
  title,
  items,
  empty,
  tone,
  showReason,
  today,
}: {
  title: string
  items: WorkItem[]
  empty: string
  tone: 'danger' | 'brand' | 'muted'
  showReason?: boolean
  today: string
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
          items.map((i) => <ItemCard key={i.key} item={i} showReason={showReason} today={today} />)
        )}
      </CardContent>
    </Card>
  )
}
