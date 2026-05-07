import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { ProgressRing } from '@/components/ui/progress-ring'

type DeliverableLine = {
  id: string
  title: string
  source: 'package' | 'incentive' | 'custom'
  is_incentive: boolean
  status: string
  actual_count: number
  target_count: number | null
  target_unit: string | null
  frequency: string | null
}

type Props = {
  title: string
  subtitle?: string
  config: Record<string, unknown>
  deliverables: DeliverableLine[]
  /** When set, this section is hidden if no deliverables match (used for
   *  status-filtered views so empty modules don't add visual noise). */
  hideWhenEmpty?: boolean
}

const sourceBadge = {
  package: { variant: 'secondary' as const, label: null as string | null },
  incentive: { variant: 'success' as const, label: 'Free Bonus' },
  custom: { variant: 'info' as const, label: 'Custom' },
}

const statusVariant: Record<
  string,
  'secondary' | 'info' | 'success' | 'warning' | 'destructive'
> = {
  pending: 'secondary',
  in_progress: 'info',
  done: 'success',
  skipped: 'warning',
  blocked: 'destructive',
}

const isCompleted = (d: DeliverableLine) => {
  if (d.status === 'done') return true
  if (d.target_count != null && d.target_count > 0) {
    return d.actual_count >= d.target_count
  }
  return false
}

// Module section with progress ring + tabular deliverable list. Replaces
// the older ModuleCard list-of-bordered-rows style for the plan page.
// Mirrors the reference layout (3/6 ring on the left, deliverable + status
// columns on the right) using only existing design tokens.
export function ModuleSection({
  title,
  subtitle,
  config,
  deliverables,
  hideWhenEmpty,
}: Props) {
  if (hideWhenEmpty && deliverables.length === 0) return null

  const completed = deliverables.filter(isCompleted).length
  const total = deliverables.length

  const configEntries = Object.entries(config)

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <ProgressRing value={completed} max={total} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-heading">{title}</h2>
              <span className="text-xs font-medium text-body">
                {completed}/{total || 0}
              </span>
            </div>
            {subtitle && (
              <p className="mt-0.5 text-sm text-body">{subtitle}</p>
            )}
            {configEntries.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-body">
                {configEntries.map(([k, v]) => (
                  <li key={k}>
                    <span className="text-body">{k.replace(/_/g, ' ')}</span>
                    <span className="ml-1 font-medium text-heading">{String(v)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {deliverables.length === 0 ? (
          <p className="text-sm text-body">No items in this module yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-light">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-secondary-soft text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-2 font-medium">Deliverable</th>
                  <th className="px-4 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d, i) => {
                  const source = sourceBadge[d.source]
                  const target = d.target_count ?? 0
                  const actual = d.actual_count ?? 0
                  const showMeter = target > 1
                  return (
                    <tr
                      key={d.id}
                      className={
                        i === 0
                          ? ''
                          : 'border-t border-border-light'
                      }
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-heading">
                            {d.title}
                          </span>
                          {source.label && (
                            <Badge variant={source.variant}>{source.label}</Badge>
                          )}
                          {d.frequency && (
                            <span className="text-xs text-body">
                              · {d.frequency.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {showMeter && (
                          <div className="mt-2 max-w-md">
                            <div className="mb-1 flex items-center justify-between text-xs text-body">
                              <span>
                                {actual} of {target} {d.target_unit ?? ''}
                              </span>
                              <span>
                                {Math.min(100, Math.round((actual / target) * 100))}%
                              </span>
                            </div>
                            <ProgressBar value={actual} max={target} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Badge variant={statusVariant[d.status] ?? 'secondary'}>
                          {d.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
