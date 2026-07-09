import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type GbpSnapshot = {
  rating: number | null
  review_count: number | null
  posts_30d: number | null
  captured_on: string | null
}

export type GbpLatestPost = {
  title: string | null
  excerpt: string | null
  published_at: string | null
  url: string | null
}

export function GoogleBusinessProfileCard({
  snapshot,
  latestPost,
}: {
  snapshot: GbpSnapshot | null
  latestPost: GbpLatestPost | null
}) {
  const hasAnyData = snapshot && (snapshot.rating != null || (snapshot.review_count ?? 0) > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Google Business Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-sm text-body">
            GBP data updates weekly. Listing details and recent posts will appear here on the next sync.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Rating + reviews row */}
            <div className="flex items-baseline gap-3">
              <Stars value={snapshot.rating ?? 0} />
              <span className="text-2xl font-semibold tabular-nums text-heading">
                {snapshot.rating != null ? snapshot.rating.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-body">
                {snapshot.review_count ?? 0} {(snapshot.review_count ?? 0) === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {/* Work-log line, deliberately number-free: the count comes from
                when staff filed the work (which can lag real publish dates),
                so a specific figure invites false-precision complaints. */}
            <div className="text-sm text-body">GBP posts logged in last 30 days</div>

            {/* Latest GBP post preview */}
            {latestPost?.excerpt && (
              <div className="rounded border border-border-default bg-bg-base p-3">
                <div className="text-[10px] uppercase tracking-wider text-body-subtle">
                  Latest post
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-heading">
                  {latestPost.excerpt}
                </p>
                {latestPost.url && (
                  <p className="mt-2 text-xs text-body">
                    <a
                      href={latestPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      View on Google
                    </a>
                  </p>
                )}
              </div>
            )}

            {snapshot.captured_on && (
              // The date only covers rating + review count (the weekly listing
              // check) — the posts count above is live from our work log. Flag
              // it when the listing check is overdue instead of quietly
              // presenting stale numbers as current.
              <p
                className={`text-center text-[10px] uppercase tracking-wider ${
                  isStale(snapshot.captured_on) ? 'text-fg-warning-strong' : 'text-body-subtle'
                }`}
              >
                Rating &amp; reviews as of {new Date(snapshot.captured_on).toLocaleDateString()}
                {isStale(snapshot.captured_on) && ' · refresh pending'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// The listing check runs weekly — anything older than two runs is stuck.
function isStale(capturedOn: string): boolean {
  return Date.now() - new Date(capturedOn).getTime() > 14 * 24 * 60 * 60 * 1000
}

// 5-star rating row with half-star precision. Decorative — accessibility
// label conveys the same number to screen readers.
function Stars({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value))
  const full = Math.floor(clamped)
  const hasHalf = clamped - full >= 0.25 && clamped - full < 0.75
  const overflowFull = clamped - full >= 0.75 ? 1 : 0
  const filled = full + overflowFull
  return (
    <div className="flex items-center gap-0.5" aria-label={`${clamped.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const state = i < filled ? 'full' : i === filled && hasHalf ? 'half' : 'empty'
        return <Star key={i} state={state} />
      })}
    </div>
  )
}

function Star({ state }: { state: 'full' | 'half' | 'empty' }) {
  const fillId = `half-${Math.random().toString(36).slice(2, 8)}`
  if (state === 'half') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={fillId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l2.92 6.32 6.94.78-5.16 4.78 1.4 6.84L12 17.27 5.9 20.72l1.4-6.84L2.14 9.1l6.94-.78L12 2z"
          fill={`url(#${fillId})`}
        />
      </svg>
    )
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={state === 'full' ? '#f59e0b' : '#e5e7eb'}
      aria-hidden="true"
    >
      <path d="M12 2l2.92 6.32 6.94.78-5.16 4.78 1.4 6.84L12 17.27 5.9 20.72l1.4-6.84L2.14 9.1l6.94-.78L12 2z" />
    </svg>
  )
}
