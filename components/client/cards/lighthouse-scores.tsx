import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RingChart } from '@/components/ui/ring-chart'
import { Info } from 'lucide-react'

export type LighthouseScores = {
  performance: number | null
  accessibility: number | null
  best_practices: number | null
  seo: number | null
  /** When the underlying lighthouse run was captured. */
  captured_on: string | null
  /** Source of the displayed Page Speed score, drives the small caption + tooltip. */
  source?: 'crux_only' | 'lab_only' | 'blended'
  /** The two component scores when blended; exposed for tooltip / admin debug. */
  crux_score?: number | null
  lab_score?: number | null
}

// Per Nathan's feedback (2026-04-30): use plain-English labels instead of
// raw Lighthouse names. Tooltips give a one-line explanation; the band
// label under each score (Good / Needs work / Poor) helps clients judge
// the number without knowing PSI scoring rules.
const METRICS = [
  {
    key: 'performance',
    label: 'Page Speed',
    tooltip: 'How quickly your site loads for real visitors. 90+ is great.',
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    tooltip: 'How usable your site is for people using screen readers, keyboard navigation, etc.',
  },
  {
    key: 'best_practices',
    label: 'Code Quality',
    tooltip: 'Whether your site follows modern web standards (HTTPS, secure libraries, no broken APIs).',
  },
  {
    key: 'seo',
    label: 'SEO',
    tooltip: 'How well your site is set up for search engines (meta tags, mobile-friendliness, structure).',
  },
] as const

function sourceLabel(s?: LighthouseScores['source']): string {
  if (s === 'crux_only') return 'Real-user data · last 28 days'
  if (s === 'blended') return 'Real users (66%) + simulated test (34%)'
  return 'Simulated test'
}

function sourceTooltip(s: LighthouseScores | null): string {
  if (!s) return ''
  if (s.source === 'crux_only') {
    return 'This score reflects what actual Chrome visitors experienced on your site over the last 28 days.'
  }
  if (s.source === 'blended') {
    return `Blended score: 66% real-user data (${s.crux_score ?? '—'}/100 from last 28 days of Chrome visitors) + 34% simulated test (${s.lab_score ?? '—'}/100 from PageSpeed Insights on a throttled mid-tier mobile). Real-user data is what Google uses for ranking.`
  }
  return 'This site does not yet have enough Chrome visitor data to compute a real-user score, so the displayed value is from a simulated test on a throttled mid-tier mobile device.'
}

export function LighthouseScoresCard({ scores }: { scores: LighthouseScores | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Site Health Scores</CardTitle>
      </CardHeader>
      <CardContent>
        {!scores || (scores.performance == null && scores.seo == null) ? (
          <p className="text-sm text-body">
            No site health audit yet. Scores update weekly once the site is connected.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {METRICS.map((m) => (
                <RingChart
                  key={m.key}
                  value={scores[m.key]}
                  label={m.label}
                  tooltip={m.tooltip}
                  showBandLabel
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-body-subtle">
              <span>{sourceLabel(scores.source)}</span>
              <span
                title={sourceTooltip(scores)}
                aria-label={sourceTooltip(scores)}
                className="cursor-help"
              >
                <Info className="h-3 w-3" />
              </span>
            </div>
            {scores.captured_on && (
              <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-body-subtle">
                As of {new Date(scores.captured_on).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
