'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteTaskTemplate } from '@/lib/actions/task-templates'

export function TemplateDeleteButton({ templateId, name }: { templateId: string; name: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onDelete() {
    if (!confirm(`Delete the "${name}" template? Tasks already created from it are unaffected.`)) return
    startTransition(async () => {
      const res = await deleteTaskTemplate(templateId)
      if (res.ok) router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending} aria-label="Delete template">
      <Trash2 className="h-4 w-4 text-body-subtle hover:text-fg-danger" />
    </Button>
  )
}
