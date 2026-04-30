import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RingChart } from '@/components/ui/ring-chart'

export type LighthouseScores = {
  performance: number | null
  accessibility: number | null
  best_practices: number | null
  seo: number | null
  /** When the underlying lighthouse run was captured. */
  captured_on: string | null
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
            {scores.captured_on && (
              <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-body-subtle">
                As of {new Date(scores.captured_on).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
