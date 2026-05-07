import { cn } from '@/lib/utils/cn'

type Props = {
  value: number
  max: number
  /** Outer diameter in px. */
  size?: number
  /** Stroke thickness in px. */
  strokeWidth?: number
  /** Center label override; defaults to `value/max`. */
  label?: React.ReactNode
  className?: string
}

// SVG donut. Auto-color matches ProgressBar: full → green, partial →
// amber, zero → neutral. Used in the plan-page module sections.
export function ProgressRing({
  value,
  max,
  size = 56,
  strokeWidth = 6,
  label,
  className,
}: Props) {
  const safeMax = Math.max(max, 0)
  const pct = safeMax === 0 ? 0 : Math.min(100, Math.max(0, (value / safeMax) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (pct / 100) * circumference

  const trackClass =
    safeMax === 0 || value === 0
      ? 'stroke-neutral-tertiary-soft'
      : value >= safeMax
      ? 'stroke-success-soft'
      : 'stroke-warning-soft'

  const fillClass =
    safeMax === 0 || value === 0
      ? 'stroke-neutral-quaternary'
      : value >= safeMax
      ? 'stroke-fg-success-strong'
      : 'stroke-fg-warning'

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn(fillClass, 'transition-[stroke-dasharray]')}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-heading">
        {label ?? `${value}/${max}`}
      </span>
    </div>
  )
}
