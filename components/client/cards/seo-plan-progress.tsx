import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type DeliverableProgress = {
  id: string
  title: string
  status: 'done' | 'in_progress' | 'pending' | 'blocked'
  /** Targeted unit count from the package template. */
  target_count: number | null
  /** Actuals computed at view layer (or 0 for pending). */
  actual_count: number | null
}

export type PackageHeader = {
  display_name: string
  monthly_fee_cents: number | null
}

type Props = {
  packageHeader: PackageHeader | null
  deliverables: DeliverableProgress[]
}

export function SeoPlanProgressCard({ packageHeader, deliverables }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">SEO Plan Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {packageHeader && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">{packageHeader.display_name}</span>
            {packageHeader.monthly_fee_cents != null && (
              <Badge variant="secondary" className="font-medium">
                ${(packageHeader.monthly_fee_cents / 100).toLocaleString()}/mo
              </Badge>
            )}
          </div>
        )}

        {deliverables.length === 0 ? (
          <p className="text-sm text-body">No active deliverables this period.</p>
        ) : (
          <ul className="space-y-4">
            {deliverables.map((d) => {
              const target = d.target_count ?? 0
              const actual = d.actual_count ?? 0
              const isDone = target > 0 && actual >= target
              return (
                <li key={d.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-fg-disabled" />
                      )}
                      <span className={cn('text-body', isDone && 'text-heading')}>
                        {d.title}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-body">
                      {target > 0 ? `${actual}/${target}` : '—'}
                    </span>
                  </div>
                  <ProgressBar value={actual} max={target} />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
