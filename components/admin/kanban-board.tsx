'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
}

const COLUMNS: { key: BoardStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'in_review', label: 'In review' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
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
}: {
  items: KanbanItem[]
  canReopen: boolean
  showAssigneeFilter?: boolean
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
    startTransition(async () => {
      const res =
        item.kind === 'task'
          ? await updateTaskStatus(item.id, target)
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
            className={`flex min-h-[8rem] flex-col rounded-lg border p-2 transition-colors ${
              overCol === col.key ? 'border-border-brand bg-brand-soft/40' : 'border-border-default bg-neutral-secondary-soft/40'
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
                      {item.kind === 'deliverable' && <Badge variant="secondary">deliv</Badge>}
                    </div>
                    {item.meta && <p className="mt-1 text-xs text-body-subtle">{item.meta}</p>}
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
