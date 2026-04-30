import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

export type RecentUpdate = {
  id: string
  kind: 'blog' | 'video' | 'call' | 'review' | 'social' | 'other'
  title: string
  occurred_at: string
}

const KIND_DOT = {
  blog: 'bg-brand',
  video: 'bg-warning-soft0',
  call: 'bg-sky-500',
  review: 'bg-success-soft0',
  social: 'bg-pink-500',
  other: 'bg-gray',
} as const

export function RecentUpdatesCard({ updates }: { updates: RecentUpdate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        {updates.length === 0 ? (
          <p className="text-sm text-body">
            Recent activity (blog posts, videos, calls) will show up here as it lands.
          </p>
        ) : (
          <ul className="space-y-3">
            {updates.slice(0, 6).map((u) => (
              <li key={u.id} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[u.kind]}`} />
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[10px] uppercase tracking-wider text-body-subtle">recent</div>
                  <div className="truncate text-sm text-heading">{u.title}</div>
                  <div className="text-xs text-body">
                    {formatDistanceToNow(new Date(u.occurred_at), { addSuffix: true })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
