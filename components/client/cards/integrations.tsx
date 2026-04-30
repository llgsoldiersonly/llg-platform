import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, KeyRound, Megaphone, Search, ExternalLink } from 'lucide-react'

export type IntegrationLink = {
  key: 'ga4' | 'gsc' | 'google_ads' | 'lsa' | 'keyword_tool'
  /** External URL (for ga4/gsc/google_ads/lsa) or internal route (keyword_tool). */
  href: string
  /** External links open in new tab; internal links navigate within the app. */
  external: boolean
}

const META = {
  ga4:           { label: 'Google Analytics',       cta: 'View dashboard', Icon: LineChart, color: 'bg-amber-100 text-fg-warning' },
  gsc:           { label: 'Google Search Console',  cta: 'Open Console',   Icon: KeyRound,  color: 'bg-neutral-tertiary-soft text-body' },
  google_ads:    { label: 'Google Ads',             cta: 'View account',   Icon: Megaphone, color: 'bg-blue-100 text-blue-700' },
  lsa:           { label: 'LSA',                    cta: 'View account',   Icon: Megaphone, color: 'bg-emerald-100 text-fg-success-strong' },
  keyword_tool:  { label: 'Keyword Tool',           cta: 'Open SEO Plan',  Icon: Search,    color: 'bg-brand-soft text-fg-brand' },
} as const

export function IntegrationsCard({ links }: { links: IntegrationLink[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Integrations</CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-body">
            Once your accounts are linked, you&apos;ll see direct click-out links here.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const { label, cta, Icon, color } = META[l.key]
              const className =
                'group flex items-center gap-3 rounded-lg border border-border-light p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-brand-subtle hover:bg-brand-softer hover:shadow-md'
              const inner = (
                <>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="text-sm font-medium text-heading">{label}</div>
                    <div className="text-xs text-fg-brand group-hover:underline">
                      {cta}
                    </div>
                  </div>
                  {l.external && <ExternalLink className="h-3.5 w-3.5 text-body-subtle" />}
                </>
              )
              return (
                <li key={l.key}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={className}>
                      {inner}
                    </a>
                  ) : (
                    <Link href={l.href} className={className}>
                      {inner}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
