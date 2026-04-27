import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  phase?: string
}

const sourceBadge = {
  package: { variant: 'secondary' as const, label: null as string | null },
  incentive: { variant: 'success' as const, label: 'Free Bonus' },
  custom: { variant: 'info' as const, label: 'Custom' },
}

const statusVariant: Record<string, 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'info',
  done: 'success',
  skipped: 'warning',
  blocked: 'destructive',
}

// Generic shell every package module reuses. Each specific module
// (SEO, Local, etc.) wraps this with its own subtitle + future-phase
// content blocks (charts, lists, etc.).
export function ModuleCard({ title, subtitle, config, deliverables, phase }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {phase && (
            <Badge variant="outline" className="font-mono">
              charts in {phase}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(config).length > 0 && (
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p className="mb-1 font-medium uppercase tracking-wide text-slate-500">
              Plan limits
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(config).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-right text-slate-900">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {deliverables.length === 0 ? (
          <p className="text-sm text-slate-500">No items in this module yet.</p>
        ) : (
          <ul className="space-y-2">
            {deliverables.map((d) => {
              const source = sourceBadge[d.source]
              const target = d.target_count
              const completed = target ? Math.min(d.actual_count, target) : d.actual_count
              const pct = target ? Math.round((completed / target) * 100) : 0
              return (
                <li key={d.id} className="rounded-md border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{d.title}</span>
                        {source.label && <Badge variant={source.variant}>{source.label}</Badge>}
                        <Badge variant={statusVariant[d.status] ?? 'secondary'}>
                          {d.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {target && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{completed} of {target} {d.target_unit ?? ''}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-slate-900 transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
