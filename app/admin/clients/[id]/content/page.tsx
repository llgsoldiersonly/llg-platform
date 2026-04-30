import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyIntegration } from '@/components/admin/empty-integration'

export const dynamic = 'force-dynamic'

type Post = {
  id: string
  source_type: string
  external_id: string
  slug: string | null
  title: string | null
  excerpt: string | null
  categories: string[] | null
  tags: string[] | null
  language: string | null
  published_at: string | null
  modified_at: string | null
  url: string | null
}

export default async function ClientContentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supa = createAdminClient()

  const [{ data: client }, { data: creds }, { data: posts }] = await Promise.all([
    supa.from('clients').select('id, firm_name, primary_domain').eq('id', id).maybeSingle(),
    supa
      .from('client_credentials')
      .select('wp_username, wp_app_password')
      .eq('client_id', id)
      .maybeSingle(),
    supa
      .from('posts')
      .select('id, source_type, external_id, slug, title, excerpt, categories, tags, language, published_at, modified_at, url')
      .eq('client_id', id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50)
      .returns<Post[]>(),
  ])

  if (!client) notFound()

  const isConfigured = !!(creds?.wp_username && creds?.wp_app_password && client.primary_domain)
  const list = posts ?? []

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration
          clientId={id}
          serviceName="WordPress"
          reason="not_configured"
          helpText={
            !client.primary_domain
              ? 'Set the primary domain on the client summary first, then add WP App Password credentials.'
              : 'Email the client to generate an App Password (template in DAY_1_CHECKLIST.md), then enter it here.'
          }
        />
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <EmptyIntegration clientId={id} serviceName="WordPress" reason="no_data" />
      </div>
    )
  }

  // Group by category for stats
  const byCategory = list.reduce<Record<string, number>>((acc, p) => {
    for (const c of p.categories ?? []) {
      acc[c] = (acc[c] ?? 0) + 1
    }
    return acc
  }, {})
  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Posts (last 50)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-heading">{list.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Top categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {topCats.length === 0 ? (
                <span className="text-xs text-body">no categories</span>
              ) : (
                topCats.map(([cat, n]) => (
                  <Badge key={cat} variant="secondary">
                    {cat} ({n})
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-body">Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(list.map((p) => p.language).filter(Boolean))).map((l) => (
                <Badge key={l!} variant="info">{l}</Badge>
              ))}
              {list.every((p) => !p.language) && (
                <span className="text-xs text-body">none detected</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent posts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-light">
            {list.map((p) => (
              <li key={p.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <a
                      href={p.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-heading hover:underline"
                    >
                      {p.title ?? p.slug ?? '(untitled)'}
                    </a>
                    <p className="mt-1 line-clamp-2 text-sm text-body">
                      {(p.excerpt ?? '').replace(/<[^>]+>/g, '').slice(0, 200)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-body">
                      <Badge variant="secondary">{p.source_type}</Badge>
                      {p.language && <Badge variant="info">{p.language}</Badge>}
                      {(p.categories ?? []).slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-body">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
