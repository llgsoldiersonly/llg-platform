'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UserCheck, UserX, Trash2 } from 'lucide-react'
import { setStaffActive, deleteStaffMember } from '@/lib/actions/invites'

type StaffProfile = {
  id: string
  full_name: string | null
  is_active: boolean
}

export function StaffRowActions({
  profile,
  currentUserId,
}: {
  profile: StaffProfile
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isSelf = profile.id === currentUserId
  const name = profile.full_name ?? 'this user'

  function toggleActive() {
    setError(null)
    startTransition(async () => {
      const res = await setStaffActive(profile.id, !profile.is_active)
      if (!res.ok) setError(res.error.message)
      else router.refresh()
    })
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteStaffMember(profile.id)
      if (!res.ok) {
        setError(res.error.message)
      } else {
        setConfirmDelete(false)
        router.refresh()
      }
    })
  }

  // A user can't act on their own account here.
  if (isSelf) {
    return <span className="text-xs text-body-subtle">you</span>
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {profile.is_active ? (
        <Button variant="outline" size="sm" onClick={toggleActive} disabled={isPending}>
          <UserX className="h-3.5 w-3.5" />
          Deactivate
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={toggleActive} disabled={isPending}>
          <UserCheck className="h-3.5 w-3.5" />
          Reactivate
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setError(null)
          setConfirmDelete(true)
        }}
        disabled={isPending}
        aria-label="Delete user"
        title="Delete user"
      >
        <Trash2 className="h-4 w-4 text-body-subtle hover:text-fg-danger" />
      </Button>

      {error && <p className="ml-2 max-w-xs text-right text-xs text-fg-danger">{error}</p>}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the user account. It only works if they have no history
              (no tasks, submissions, or comments). If they do, deactivate them instead —
              deactivating blocks their login and frees their open work while keeping the record.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-fg-danger">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
