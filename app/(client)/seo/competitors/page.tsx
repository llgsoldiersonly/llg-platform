import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientContext } from '@/lib/client-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Users, ExternalLink, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

type CompetitorRow = {
  id: string
  competitor_name: string
  competitor_domain: string | null
  google_business_profile_name: string | null
  city: string | null
  state: string | null
  notes: string | null
  is_active: boolean
}

export default async function SeoCompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string') sp.set(k, v)

  const ctx = await getClientContext(sp)
  if (!ctx) redirect('/login')

  const admin = createAdminClient()
  const { data: competitors } = await admin
    .from('dfs_competitor_sites')
    .select('id, competitor_name, competitor_domain, google_business_profile_name, city, state, notes, is_active')
    .eq('client_id', ctx.client.id)
    .order('is_active', { ascending: false })
    .order('competitor_name', { ascending: true })
    .returns<CompetitorRow[]>()

  const active = (competitors ?? []).filter((c) => c.is_active)
  const inactive = (competitors ?? []).filter((c) => !c.is_active)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Competitors</h1>
        <p className="mt-1 text-sm text-body">
          The local firms we benchmark you against. Their rank progress, citation counts,
          and review trajectories shape the &ldquo;Competitor gap&rdquo; sub-score on your overview.
        </p>
      </div>

      {(competitors?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="No competitors set yet"
          description="Your account manager picks 3–5 local firms whose Google visibility we track alongside yours. Once they're added, this page will show how you stack up — overlap on keywords, citation gaps, review-velocity differences. Reply to your account manager or open a ticket if you want to nominate a competitor to track."
        />
      ) : (
        <>
          {active.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tracking ({active.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-light">
                  {active.map((c) => (
                    <CompetitorRow key={c.id} c={c} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {inactive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No longer tracked ({inactive.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-light opacity-60">
                  {inactive.map((c) => (
                    <CompetitorRow key={c.id} c={c} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function CompetitorRow({ c }: { c: CompetitorRow }) {
  const location = [c.city, c.state].filter(Boolean).join(', ')
  return (
    <li className="grid grid-cols-12 items-center gap-3 px-6 py-4">
      <div className="col-span-7">
        <div className="flex items-center gap-2">
          <span className="font-medium text-heading">{c.competitor_name}</span>
          {!c.is_active && <Badge variant="secondary">paused</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-body">
          {c.google_business_profile_name && c.google_business_profile_name !== c.competitor_name && (
            <>GBP: {c.google_business_profile_name} · </>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {location}
            </span>
          )}
        </p>
        {c.notes && <p className="mt-1 text-xs text-body-subtle">{c.notes}</p>}
      </div>
      <div className="col-span-5 text-right">
        {c.competitor_domain ? (
          <a
            href={c.competitor_domain.startsWith('http') ? c.competitor_domain : `https://${c.competitor_domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fg-brand hover:underline"
          >
            {c.competitor_domain.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-body-subtle">No domain</span>
        )}
      </div>
    </li>
  )
}
