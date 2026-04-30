import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  variant?: 'card' | 'plain'
  className?: string
}

// Generic empty state for sections that have no data yet (an empty ticket
// list, no tasks assigned, etc.). For integrations specifically, use
// EmptyIntegration — it carries the credentials/no-data distinction.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'card',
  className,
}: Props) {
  const inner = (
    <div className={cn('flex flex-col items-center gap-3 p-10 text-center', className)}>
      {Icon && <Icon className="h-8 w-8 text-fg-disabled" />}
      <p className="text-sm font-medium text-body">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-body">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )

  if (variant === 'plain') return inner
  return (
    <Card>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  )
}
