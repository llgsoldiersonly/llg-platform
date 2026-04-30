import { cn } from '@/lib/utils/cn'

type Props = {
  value: number | null
  /** 0-100 max. Defaults to 100 (typical lighthouse-style score). */
  max?: number
  label?: string
  /** Override band color. By default: ≥90 green, ≥70 amber, ≥0 red, null gray. */
  variant?: 'auto' | 'purple' | 'green' | 'amber' | 'red' | 'gray'
  size?: 'sm' | 'md'
  className?: string
}

const BAND_STROKE: Record<Exclude<Props['variant'], undefined>, string> = {
  auto: '',                           // resolved at render
  purple: 'stroke-(--color-llg-purple-700)',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  red: 'stroke-red-500',
  gray: 'stroke-slate-300',
}

function autoVariant(value: number | null): Exclude<Props['variant'], 'auto' | undefined> {
  if (value == null) return 'gray'
  if (value >= 90) return 'green'
  if (value >= 70) return 'amber'
  return 'red'
}

// SVG ring with the score in the center. Used for lighthouse-style metrics
// (Performance / Accessibility / Best Practices / SEO).
export function RingChart({
  value,
  max = 100,
  label,
  variant = 'auto',
  size = 'md',
  className,
}: Props) {
  const dim = size === 'sm' ? 60 : 84
  const stroke = size === 'sm' ? 6 : 8
  const r = (dim - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  const dashOffset = c - (pct / 100) * c

  const resolved = variant === 'auto' ? autoVariant(value) : variant
  const band = BAND_STROKE[resolved]
  const labelClass =
    resolved === 'green' ? 'text-emerald-700'
    : resolved === 'amber' ? 'text-amber-700'
    : resolved === 'red' ? 'text-red-700'
    : resolved === 'purple' ? 'text-(--color-llg-purple-700)'
    : 'text-slate-500'

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-100"
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            className={cn('transition-[stroke-dashoffset]', band)}
          />
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-semibold',
            size === 'sm' ? 'text-base' : 'text-xl',
            labelClass
          )}
        >
          {value == null ? '—' : value}
        </span>
      </div>
      {label && <span className="text-xs text-slate-600">{label}</span>}
    </div>
  )
}
