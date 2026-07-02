'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { InfoTip } from '@/components/ui/infotip'
import { updateTaskStatus, reassignTask } from '@/lib/actions/tasks'
import { updateDeliverableStatus } from '@/lib/actions/deliverables'
import { submitDeliverableProof } from '@/lib/actions/submissions'

export type BoardStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done'

export type KanbanItem = {
  kind: 'task' | 'deliverable'
  id: string
  title: string
  meta?: string | null
  boardStatus: BoardStatus
  priority: string | null
  clientId: string | null
  assigneeName?: string | null
  assigneeId?: string | null
  blockReason?: string | null
  // Workflow step (has a parent task). Steps skip the submit gate — "done" on
  // a step isn't the final client submission, the parent still carries that.
  isSubtask?: boolean
}

const COLUMNS: { key: BoardStatus; label: string; tip: string }[] = [
  { key: 'todo', label: 'To do', tip: 'Not started yet. Drag a card here to reset it.' },
  { key: 'in_progress', label: 'In progress', tip: "You're actively working on it." },
  {
    key: 'in_review',
    label: 'In review',
    tip: "You're finished — a department lead or super-admin checks it from here. This is as far as staff take a task.",
  },
  {
    key: 'blocked',
    label: 'Paused',
    tip: "Stuck waiting on something. Moving a card here asks what it's waiting on, so nobody has to chase you.",
  },
  {
    key: 'done',
    label: 'Submitted',
    tip: 'Final sign-off — only a super-admin or department lead can move a task here. Exception: you can finish your own workflow steps.',
  },
]

// Sentinel filter value for "show only unassigned" (distinct from '' = All).
const UNASSIGNED = '__unassigned__'

// Per-assignee color coding. Colors are decorative and per-person, so we use
// raw hex via inline styles rather than Tailwind classes (dynamic class names
// would be purged). A card gets a left stripe + a name chip in its assignee's
// color; unassigned cards get a neutral grey dashed stripe so they read as
// "needs an owner". The color is a deterministic hash of the assignee name, so
// the same person is always the same color across sessions and boards.
type AssigneeColor = { stripe: string; soft: string; text: string }

const ASSIGNEE_COLORS: AssigneeColor[] = [
  { stripe: '#6366f1', soft: '#eef2ff', text: '#3730a3' }, // indigo
  { stripe: '#0ea5e9', soft: '#e0f2fe', text: '#075985' }, // sky
  { stripe: '#10b981', soft: '#d1fae5', text: '#065f46' }, // emerald
  { stripe: '#f59e0b', soft: '#fef3c7', text: '#92400e' }, // amber
  { stripe: '#ec4899', soft: '#fce7f3', text: '#9d174d' }, // pink
  { stripe: '#8b5cf6', soft: '#ede9fe', text: '#5b21b6' }, // violet
  { stripe: '#14b8a6', soft: '#ccfbf1', text: '#115e59' }, // teal
  { stripe: '#f97316', soft: '#ffedd5', text: '#9a3412' }, // orange
  { stripe: '#84cc16', soft: '#ecfccb', text: '#3f6212' }, // lime
  { stripe: '#06b6d4', soft: '#cffafe', text: '#155e75' }, // cyan
]

const UNASSIGNED_COLOR: AssigneeColor = { stripe: '#cbd5e1', soft: '#f1f5f9', text: '#475569' }

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function colorForAssignee(name: string | null | undefined): AssigneeColor {
  if (!name) return UNASSIGNED_COLOR
  return ASSIGNEE_COLORS[hashString(name) % ASSIGNEE_COLORS.length]
}

// Deliverables have no "in_review" state — map the board columns onto their enum.
function boardToDeliverableStatus(s: BoardStatus): 'pending' | 'in_progress' | 'done' | 'blocked' {
  switch (s) {
    case 'todo': return 'pending'
    case 'in_review': return 'in_progress'
    case 'in_progress': return 'in_progress'
    case 'blocked': return 'blocked'
    case 'done': return 'done'
  }
}

export function KanbanBoard({
  items,
  canReopen,
  canSubmit = false,
  showAssigneeFilter = false,
  taskDetailBase,
  assignableStaff,
}: {
  items: KanbanItem[]
  canReopen: boolean
  // Allow moving a task into Submitted without full reopen rights. Super-admins
  // (canReopen) always can; department leads get this for their own department.
  // The server still authorizes the specific task, so this only relaxes the UI.
  canSubmit?: boolean
  showAssigneeFilter?: boolean
  taskDetailBase?: string
  // When provided, task cards show a reassign dropdown (used by the department
  // board so a lead can reassign within their team). The server re-authorizes.
  assignableStaff?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState<KanbanItem | null>(null)
  const [overCol, setOverCol] = useState<BoardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignee, setAssignee] = useState('')

  const assignees = useMemo(
    () => Array.from(new Set(items.map((i) => i.assigneeName).filter((n): n is string => !!n))).sort(),
    [items]
  )
  const hasUnassigned = useMemo(() => items.some((i) => !i.assigneeName), [items])

  const shown =
    assignee === UNASSIGNED
      ? items.filter((i) => !i.assigneeName)
      : assignee
        ? items.filter((i) => i.assigneeName === assignee)
        : items

  const byCol = useMemo(() => {
    const map: Record<BoardStatus, KanbanItem[]> = {
      todo: [], in_progress: [], in_review: [], blocked: [], done: [],
    }
    for (const i of shown) map[i.boardStatus].push(i)
    return map
  }, [shown])

  function move(item: KanbanItem, target: BoardStatus) {
    if (item.boardStatus === target) return
    setError(null)

    // Submitting a task (→ Submitted) needs submit rights (super-admin, or a
    // department lead on their own board) — except workflow steps, which any
    // staffer can finish. The server re-checks per task.
    if (item.kind === 'task' && target === 'done' && !item.isSubtask && !canReopen && !canSubmit) {
      setError('Only a super-admin or department lead can submit a task. Move it to In review instead.')
      return
    }

    // Pausing a task asks why it's stalled.
    let reason: string | null = null
    if (item.kind === 'task' && target === 'blocked') {
      reason = window.prompt('Why is this paused? (what is it waiting on?)') ?? null
      if (reason === null) return // cancelled
    }

    startTransition(async () => {
      const res =
        item.kind === 'task'
          ? await updateTaskStatus(item.id, target, reason)
          : await updateDeliverableStatus(item.id, boardToDeliverableStatus(target), item.clientId ?? '')
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  function reassign(item: KanbanItem, userId: string) {
    if (item.kind !== 'task') return
    setError(null)
    startTransition(async () => {
      const res = await reassignTask(item.id, userId || null)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  // Inline proof: attach a URL straight to a deliverable card. The kind is
  // inferred server-side from the deliverable's code, so all we send is the link.
  function addProof(item: KanbanItem) {
    if (item.kind !== 'deliverable') return
    const url = window.prompt('Paste the URL that proves this deliverable is done:')
    if (url === null) return // cancelled
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const res = await submitDeliverableProof(item.id, trimmed)
      if (!res.ok) setError(res.error.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {(showAssigneeFilter || error) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {showAssigneeFilter && (
            <>
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-56 text-sm">
                <option value="">All (assigned + unassigned)</option>
                {hasUnassigned && <option value={UNASSIGNED}>Unassigned</option>}
                {assignees.length > 0 && <option disabled>──────────</option>}
                {assignees.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>

              {/* Color legend */}
              <div className="flex flex-wrap items-center gap-2">
                {assignees.map((a) => {
                  const c = colorForAssignee(a)
                  return (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: c.soft, color: c.text }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.stripe }} />
                      {a}
                    </span>
                  )
                })}
                {hasUnassigned && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: UNASSIGNED_COLOR.soft, color: UNASSIGNED_COLOR.text, borderColor: UNASSIGNED_COLOR.stripe }}
                  >
                    Unassigned
                  </span>
                )}
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(col.key)
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => {
              if (dragging) move(dragging, col.key)
              setDragging(null)
              setOverCol(null)
            }}
            className={`flex min-h-[8rem] flex-col rounded-lg border-2 p-2 transition-colors ${
              overCol === col.key ? 'border-border-brand bg-brand-soft/40' : 'border-border-brand/40 bg-neutral-secondary-soft/40'
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-body">
                {col.label}
                <InfoTip text={col.tip} side="bottom" />
              </span>
              <span className="text-xs text-body-subtle">{byCol[col.key].length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {byCol[col.key].map((item) => {
                const hot = item.priority === 'urgent' || item.priority === 'high'
                const color = colorForAssignee(item.assigneeName)
                const unassigned = !item.assigneeName
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    draggable={!pending}
                    onDragStart={() => setDragging(item)}
                    onDragEnd={() => setDragging(null)}
                    style={
                      showAssigneeFilter
                        ? { borderLeft: `4px ${unassigned ? 'dashed' : 'solid'} ${color.stripe}` }
                        : undefined
                    }
                    className={`cursor-grab rounded-md border p-2.5 text-sm shadow-xs active:cursor-grabbing ${
                      hot ? 'border-border-danger-subtle bg-danger-soft/40' : 'border-border-default bg-bg-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight text-heading">{item.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.kind === 'deliverable' && (
                          <InfoTip text="A monthly package item — work you submit counts toward its target. Use the paperclip to attach proof.">
                            <Badge variant="secondary">deliv</Badge>
                          </InfoTip>
                        )}
                        {item.isSubtask && (
                          <InfoTip text="One stage of a task's workflow. Finishing it automatically notifies whoever owns the next step — you can move your own steps to Submitted.">
                            <Badge variant="secondary">step</Badge>
                          </InfoTip>
                        )}
                        {item.kind === 'deliverable' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              addProof(item)
                            }}
                            disabled={pending}
                            className="text-body-subtle hover:text-fg-brand disabled:opacity-50"
                            aria-label="Add proof URL"
                            title="Add proof URL"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {item.kind === 'task' && taskDetailBase && (
                          <Link
                            href={`${taskDetailBase}/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            className="text-body-subtle hover:text-fg-brand"
                            aria-label="Open task"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {item.meta && <p className="mt-1 text-xs text-body-subtle">{item.meta}</p>}
                    {item.boardStatus === 'blocked' && item.blockReason && (
                      <p className="mt-1 rounded bg-neutral-secondary-soft px-1.5 py-1 text-xs text-body">
                        ⏸ {item.blockReason}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      {hot && (
                        <InfoTip text="Priority set by a super-admin — do these before anything else. It also jumps the item up your Next up queue.">
                          <Badge variant="destructive">{item.priority}</Badge>
                        </InfoTip>
                      )}
                      {showAssigneeFilter ? (
                        item.assigneeName ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: color.soft, color: color.text }}
                          >
                            {item.assigneeName}
                          </span>
                        ) : (
                          <span
                            className="rounded border border-dashed px-1.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: UNASSIGNED_COLOR.soft, color: UNASSIGNED_COLOR.text, borderColor: UNASSIGNED_COLOR.stripe }}
                          >
                            Unassigned
                          </span>
                        )
                      ) : (
                        item.assigneeName && <span className="text-xs text-body">{item.assigneeName}</span>
                      )}
                    </div>
                    {assignableStaff && item.kind === 'task' && (
                      <Select
                        value={item.assigneeId ?? ''}
                        onChange={(e) => reassign(item, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                        disabled={pending}
                        className="mt-2 w-full text-xs"
                        aria-label="Reassign task"
                      >
                        <option value="">Unassigned</option>
                        {assignableStaff.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    )}
                  </div>
                )
              })}
              {byCol[col.key].length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-body-subtle">—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!canReopen && (
        <p className="text-xs text-body-subtle">
          Note: only a super-admin can move a card out of Done.
        </p>
      )}
    </div>
  )
}
