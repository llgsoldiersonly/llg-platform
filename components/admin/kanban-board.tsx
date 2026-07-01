'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { updateDeliverableStatus } from '@/lib/actions/deliverables'

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
  blockReason?: string | null
}

const COLUMNS: { key: BoardStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'in_review', label: 'In review' },
  { key: 'blocked', label: 'Paused' },
  { key: 'done', label: 'Submitted' },
]

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
  showAssigneeFilter = false,
  taskDetailBase,
}: {
  items: KanbanItem[]
  canReopen: boolean
  showAssigneeFilter?: boolean
  taskDetailBase?: string
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
  const shown = assignee ? items.filter((i) => i.assigneeName === assignee) : items

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

    // Submitting a task (→ Submitted) is super-admin only.
    if (item.kind === 'task' && target === 'done' && !canReopen) {
      setError('Only a super-admin can submit a task. Move it to In review instead.')
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

  return (
    <div className="space-y-3">
      {(showAssigneeFilter || error) && (
        <div className="flex items-center gap-3">
          {showAssigneeFilter && (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-56 text-sm">
              <option value="">All assignees</option>
              {assignees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
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
              <span className="text-xs font-semibold uppercase tracking-wide text-body">{col.label}</span>
              <span className="text-xs text-body-subtle">{byCol[col.key].length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {byCol[col.key].map((item) => {
                const hot = item.priority === 'urgent' || item.priority === 'high'
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    draggable={!pending}
                    onDragStart={() => setDragging(item)}
                    onDragEnd={() => setDragging(null)}
                    className={`cursor-grab rounded-md border p-2.5 text-sm shadow-xs active:cursor-grabbing ${
                      hot ? 'border-l-4 border-l-fg-danger border-border-danger-subtle bg-danger-soft/40' : 'border-border-default bg-bg-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight text-heading">{item.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.kind === 'deliverable' && <Badge variant="secondary">deliv</Badge>}
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
                      {hot && <Badge variant="destructive">{item.priority}</Badge>}
                      {item.assigneeName && <span className="text-xs text-body">{item.assigneeName}</span>}
                    </div>
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
