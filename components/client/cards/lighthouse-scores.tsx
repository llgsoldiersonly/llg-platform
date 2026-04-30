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

export function LighthouseScoresCard({ scores }: { scores: LighthouseScores | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Site Lighthouse Scores</CardTitle>
      </CardHeader>
      <CardContent>
        {!scores || (scores.performance == null && scores.seo == null) ? (
          <p className="text-sm text-slate-600">
            No lighthouse run yet. Scores update weekly once the site is connected.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <RingChart value={scores.performance} label="Performance" />
              <RingChart value={scores.accessibility} label="Accessibility" />
              <RingChart value={scores.best_practices} label="Best Practices" />
              <RingChart value={scores.seo} label="SEO" />
            </div>
            {scores.captured_on && (
              <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-slate-500">
                As of {new Date(scores.captured_on).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
