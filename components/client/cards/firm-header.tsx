import { Card, CardContent } from '@/components/ui/card'
import { format, parseISO } from 'date-fns'

export type FirmHeaderProps = {
  firmName: string
  packageName: string | null
  packageColorHex: string | null
  /** When true, renders the pre-launch trio (Ad Date / Agreed Launch). */
  preLaunch: boolean
  /** ISO date strings, optional. */
  adDate: string | null
  agreedLaunchDate: string | null
  launchDate: string | null
  nextBillingAt: string | null
}

function fmt(date: string | null): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

const FALLBACK_TIER_COLOR = '#7e22cf'

export function FirmHeaderCard({
  firmName,
  packageName,
  packageColorHex,
  preLaunch,
  adDate,
  agreedLaunchDate,
  launchDate,
  nextBillingAt,
}: FirmHeaderProps) {
  const tierColor = packageColorHex ?? FALLBACK_TIER_COLOR
  const rows = preLaunch
    ? [
        { label: 'Package', value: packageName ?? '—' },
        { label: 'Ad date', value: fmt(adDate) },
        { label: 'Agreed launch', value: fmt(agreedLaunchDate) },
      ]
    : [
        { label: 'Package', value: packageName ?? '—' },
        { label: 'Launch date', value: fmt(launchDate) },
        { label: 'Next billing', value: fmt(nextBillingAt) },
      ]

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-body-subtle">
            Law firm
          </span>
          {packageName && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: `${tierColor}1A`,
                color: tierColor,
                borderColor: `${tierColor}40`,
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tierColor }}
              />
              {preLaunch ? 'Pre-launch' : 'Live'}
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold leading-tight text-heading">{firmName}</h2>
        <dl className="grid grid-cols-1 gap-1 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-body-subtle">{r.label}</dt>
              <dd className="text-sm text-heading">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
