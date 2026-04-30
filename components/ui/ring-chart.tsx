import { cn } from '@/lib/utils/cn'

type Props = {
  value: number | null
  /** 0-100 max. Defaults to 100 (typical lighthouse-style score). */
  max?: number
  label?: string
  /** One-line plain-English explanation shown on hover. */
  tooltip?: string
  /** When true, shows a small "Good / Needs work / Poor" band label
   *  underneath the metric label. Off by default. */
  showBandLabel?: boolean
  /** Override band color. By default: ≥90 green, ≥70 amber, ≥0 red, null gray. */
  variant?: 'auto' | 'purple' | 'green' | 'amber' | 'red' | 'gray'
  size?: 'sm' | 'md'
  className?: string
}

const BAND_STROKE: Record<Exclude<Props['variant'], undefined>, string> = {
  auto: '',                           // resolved at render
  purple: 'stroke-brand',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  red: 'stroke-red-500',
  gray: 'stroke-fg-disabled',
}

// Standard PageSpeed Insights band scheme:
//   ≥90  green ("Good")
//   ≥50  amber ("Needs work")
//   <50  red   ("Poor")
// Color thresholds match the band labels below the ring so the score
// color and the text band agree.
function autoVariant(value: number | null): Exclude<Props['variant'], 'auto' | undefined> {
  if (value == null) return 'gray'
  if (value >= 90) return 'green'
  if (value >= 50) return 'amber'
  return 'red'
}

// SVG ring with the score in the center. Used for lighthouse-style metrics
// (Page Speed / Accessibility / Code Quality / SEO).
export function RingChart({
  value,
  max = 100,
  label,
  tooltip,
  showBandLabel = false,
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
    resolved === 'green' ? 'text-fg-success-strong'
    : resolved === 'amber' ? 'text-fg-warning'
    : resolved === 'red' ? 'text-fg-danger-strong'
    : resolved === 'purple' ? 'text-fg-brand'
    : 'text-body'

  // Plain-English band label: "Good" ≥90, "Needs work" ≥50, "Poor" <50.
  // Skipped when no value or band-label is opted out.
  const bandLabel =
    value == null ? null
    : value >= 90 ? 'Good'
    : value >= 50 ? 'Needs work'
    : 'Poor'

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center gap-1',
        tooltip && 'cursor-help',
        className
      )}
    >
      <div
        className="relative transition-transform duration-200 group-hover:scale-105"
        style={{ width: dim, height: dim }}
      >
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-neutral-tertiary-soft"
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
      {label && <span className="text-xs text-body">{label}</span>}
      {showBandLabel && bandLabel && (
        <span className={cn('text-[10px] uppercase tracking-wider', labelClass)}>
          {bandLabel}
        </span>
      )}

      {/* Custom hover tooltip — appears immediately on hover, styled to
       * match the rest of the design system. Replaces the native HTML
       * `title` attribute which had a long delay + OS-styled chrome. */}
      {tooltip && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute -bottom-2 left-1/2 z-20 w-48 -translate-x-1/2 translate-y-full',
            'rounded-card border border-border-default bg-dark px-3 py-2',
            'text-xs leading-snug text-white shadow-md',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100'
          )}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}
