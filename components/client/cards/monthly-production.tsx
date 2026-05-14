import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { FileText, MessageCircleQuestion, Bot, Share2, MapPin, Link as LinkIcon } from 'lucide-react'

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

export function MonthlyProductionCard({
  categories,
  periodLabel,
}: {
  categories: ProductionCategory[]
  periodLabel: string
}) {
  const totalDone = categories.reduce((sum, c) => sum + c.done, 0)
  const totalTarget = categories.reduce((sum, c) => sum + c.target, 0)

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
                  <span
                    className={
                      isInactive
                        ? 'text-xs font-medium text-body-subtle'
                        : 'text-xs font-semibold text-heading'
                    }
                  >
                    {isInactive ? 'not in package' : `${done}/${target}`}
                  </span>
                </div>
                {!isInactive && <ProgressBar value={done} max={target} />}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
