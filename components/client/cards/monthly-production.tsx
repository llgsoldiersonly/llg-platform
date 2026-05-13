'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Button } from '@/components/ui/button'
import { FileText, MessageCircleQuestion, Bot, Share2, MapPin, Link as LinkIcon, Plus } from 'lucide-react'
import { InlineSubmitModal } from '@/components/client/inline-submit-modal'
import type { SubmissionKind } from '@/lib/submissions/kinds'

export type ProductionCategory = {
  key: 'blogs' | 'faqs' | 'ai' | 'social' | 'gbp' | 'links_citations'
  label: string
  done: number
  target: number
}

const ICONS: Record<ProductionCategory['key'], typeof FileText> = {
  blogs: FileText,
  faqs: MessageCircleQuestion,
  ai: Bot,
  social: Share2,
  gbp: MapPin,
  links_citations: LinkIcon,
}

// Each visible category maps to a single submission kind for inline staff
// logging. links_citations is one row but covers two distinct kinds — we
// default to 'link'; staff can still log a 'citation' via the full form.
const CATEGORY_TO_KIND: Record<ProductionCategory['key'], SubmissionKind> = {
  blogs: 'blog',
  faqs: 'faq',
  ai: 'ai_page',
  social: 'social_post',
  gbp: 'gmb_post',
  links_citations: 'link',
}

export function MonthlyProductionCard({
  categories,
  periodLabel,
  clientId,
  isStaff = false,
}: {
  categories: ProductionCategory[]
  periodLabel: string
  // Required only when isStaff is true (used to scope inline submissions).
  clientId?: string
  isStaff?: boolean
}) {
  const totalDone = categories.reduce((sum, c) => sum + c.done, 0)
  const totalTarget = categories.reduce((sum, c) => sum + c.target, 0)
  const [openKind, setOpenKind] = useState<{ kind: SubmissionKind; label: string } | null>(null)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-lg">Monthly production</CardTitle>
          <span className="text-xs text-body">
            {totalDone}/{totalTarget} this period
          </span>
        </div>
        <p className="text-xs text-body-subtle">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {categories.map((c) => {
            const Icon = ICONS[c.key]
            const done = c.done
            const target = c.target
            const isDone = target > 0 && done >= target
            const isInactive = target === 0
            return (
              <li key={c.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={
                        isInactive
                          ? 'h-4 w-4 text-fg-disabled'
                          : isDone
                          ? 'h-4 w-4 text-emerald-500'
                          : 'h-4 w-4 text-fg-brand'
                      }
                    />
                    <span className={isInactive ? 'text-body-subtle' : 'text-heading'}>
                      {c.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {isStaff && !isInactive && clientId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setOpenKind({ kind: CATEGORY_TO_KIND[c.key], label: c.label })}
                        title={`Log a new ${c.label.toLowerCase()}`}
                        aria-label={`Log a new ${c.label.toLowerCase()}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    )}
                    <span
                      className={
                        isInactive
                          ? 'text-xs font-medium text-body-subtle'
                          : 'text-xs font-semibold text-heading'
                      }
                    >
                      {isInactive ? 'not in package' : `${done}/${target}`}
                    </span>
                  </span>
                </div>
                {!isInactive && <ProgressBar value={done} max={target} />}
              </li>
            )
          })}
        </ul>
      </CardContent>
      {isStaff && clientId && openKind && (
        <InlineSubmitModal
          open={openKind !== null}
          onOpenChange={(o) => !o && setOpenKind(null)}
          clientId={clientId}
          kind={openKind.kind}
          triggerLabel={openKind.label}
        />
      )}
    </Card>
  )
}
