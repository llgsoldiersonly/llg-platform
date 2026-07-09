import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import {
  FileText,
  MessageCircleQuestion,
  Bot,
  Share2,
  MapPin,
  Link as LinkIcon,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'

export type ProductionItem = {
  title: string
  url: string | null
  when: string // YYYY-MM-DD
}

export type ProductionCategory = {
  key: 'blogs' | 'faqs' | 'ai' | 'social' | 'gbp' | 'links_citations'
  label: string
  done: number
  target: number
  // The actual submitted work this period — each row expands to list it.
  items?: ProductionItem[]
}

const ICONS: Record<ProductionCategory['key'], typeof FileText> = {
  blogs: FileText,
  faqs: MessageCircleQuestion,
  ai: Bot,
  social: Share2,
  gbp: MapPin,
  links_citations: LinkIcon,
}

// Links/citations are hidden from the client card for now (they'd dominate
// the totals at 50/period and the per-item list is noise to clients).
const HIDDEN_KEYS: ProductionCategory['key'][] = ['links_citations']

export function MonthlyProductionCard({
  categories,
  periodLabel,
}: {
  categories: ProductionCategory[]
  periodLabel: string
}) {
  const visible = categories.filter((c) => !HIDDEN_KEYS.includes(c.key))
  const totalDone = visible.reduce((sum, c) => sum + c.done, 0)
  const totalTarget = visible.reduce((sum, c) => sum + c.target, 0)

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
          {visible.map((c) => {
            const Icon = ICONS[c.key]
            const done = c.done
            const target = c.target
            const isDone = target > 0 && done >= target
            const isInactive = target === 0
            const items = c.items ?? []
            const expandable = !isInactive && items.length > 0

            const row = (
              <>
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
                    {expandable && (
                      <ChevronDown className="h-3.5 w-3.5 text-body-subtle transition-transform group-open:rotate-180" />
                    )}
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
              </>
            )

            if (!expandable) {
              return (
                <li key={c.key} className="space-y-1.5">
                  {row}
                </li>
              )
            }

            return (
              <li key={c.key}>
                <details className="group">
                  <summary className="cursor-pointer list-none space-y-1.5 [&::-webkit-details-marker]:hidden">
                    {row}
                  </summary>
                  <ul className="mt-2 space-y-1.5 border-l-2 border-border-default pl-4">
                    {items.map((item, i) => (
                      <li key={i} className="text-sm">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 text-fg-brand hover:underline"
                          >
                            <span className="truncate">{item.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-heading">{item.title}</span>
                        )}
                        <span className="ml-1 text-xs text-body-subtle">{item.when}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
