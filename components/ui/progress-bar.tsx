import { cn } from '@/lib/utils/cn'

type Props = {
  value: number
  max: number
  /** Override the auto-derived color band. */
  variant?: 'auto' | 'green' | 'yellow' | 'gray'
  className?: string
}

// Horizontal progress bar matching the reference design's deliverable
// tracker. Auto-color: 100% → green, anything in-progress → yellow,
// 0/0 → gray (rendered empty).
export function ProgressBar({ value, max, variant = 'auto', className }: Props) {
  const safeMax = Math.max(max, 0)
  const pct = safeMax === 0 ? 0 : Math.min(100, Math.max(0, (value / safeMax) * 100))

  const band =
    variant === 'auto'
      ? safeMax === 0 || value === 0
        ? 'gray'
        : value >= safeMax
        ? 'green'
        : 'yellow'
      : variant

  const fillStyles = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    gray: 'bg-slate-200',
  }[band]

  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all', fillStyles)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
