'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { InlineSubmitModal } from '@/components/client/inline-submit-modal'
import { isValidSubmissionKind, type SubmissionKind } from '@/lib/submissions/kinds'

// The fixed sequence pre-launch firms see on their overview, per the
// 2026-05-12 whiteboard. The portal counts approved submissions of the
// matching `kind` to mark each row done.
const STEPS: { kind: string; label: string }[] = [
  { kind: 'parent_page', label: 'Parent page' },
  { kind: 'child_page', label: 'Child pages' },
  { kind: 'design_theme', label: 'Design theme' },
  { kind: 'ai_page', label: 'AI pages' },
  { kind: 'faq', label: 'FAQ pages' },
  { kind: 'gmb_build', label: 'GMB builds' },
  { kind: 'directory', label: 'Directory listings' },
  { kind: 'social_channel', label: 'Social channels' },
]

export type PreLaunchStepRow = {
  kind: string
  done_count: number
  latest_link_url: string | null
  latest_at: string | null
}

export function PreLaunchChecklistCard({
  rows,
  clientId,
  isStaff = false,
}: {
  rows: PreLaunchStepRow[]
  // Required only when isStaff is true (used to scope inline submissions).
  clientId?: string
  isStaff?: boolean
}) {
  const byKind = new Map(rows.map((r) => [r.kind, r]))
  const completed = STEPS.filter((s) => (byKind.get(s.kind)?.done_count ?? 0) > 0).length
  const [openStep, setOpenStep] = useState<{ kind: SubmissionKind; label: string } | null>(null)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-lg">Pre-launch checklist</CardTitle>
          <span className="text-xs text-body">
            {completed}/{STEPS.length} complete
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border-light">
          {STEPS.map((step) => {
            const row = byKind.get(step.kind)
            const done = (row?.done_count ?? 0) > 0
            return (
              <li key={step.kind} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-fg-disabled" />
                  )}
                  <span className={cn('text-sm', done ? 'text-heading' : 'text-body')}>
                    {step.label}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {row?.latest_link_url && (
                    <a
                      href={row.latest_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline"
                    >
                      view <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {isStaff && !done && clientId && isValidSubmissionKind(step.kind) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setOpenStep({ kind: step.kind as SubmissionKind, label: step.label })}
                    >
                      Mark done
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
      {isStaff && clientId && openStep && (
        <InlineSubmitModal
          open={openStep !== null}
          onOpenChange={(o) => !o && setOpenStep(null)}
          clientId={clientId}
          kind={openStep.kind}
          triggerLabel={openStep.label}
        />
      )}
    </Card>
  )
}

export { STEPS as PRE_LAUNCH_STEPS }
