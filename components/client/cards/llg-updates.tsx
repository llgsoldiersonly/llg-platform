import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Newspaper } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { LlgBlogPost } from '@/lib/llg-blog-feed'

export function LlgUpdatesCard({ posts }: { posts: LlgBlogPost[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-fg-brand" />
          <CardTitle className="text-lg">LLG updates</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="text-sm text-body">
            Latest articles from Legal Leads Group will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-neutral-secondary-soft"
                >
                  {p.featuredImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.featuredImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-secondary-soft">
                      <Newspaper className="h-5 w-5 text-fg-disabled" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1 text-sm font-medium leading-snug text-heading group-hover:text-fg-brand">
                      <span className="line-clamp-2">{p.title}</span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-fg-disabled group-hover:text-fg-brand" />
                    </div>
                    <div className="mt-1 text-xs text-body-subtle">
                      {formatDistanceToNow(new Date(p.publishedAt), { addSuffix: true })}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
