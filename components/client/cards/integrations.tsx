import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, KeyRound, MapPin, Megaphone, ExternalLink } from 'lucide-react'

export type IntegrationLink = {
  key: 'ga4' | 'gsc' | 'google_ads' | 'lsa' | 'gmb'
  url: string
}

const META = {
  ga4: { label: 'Google Analytics', cta: 'View dashboard', Icon: LineChart, color: 'bg-amber-100 text-amber-700' },
  gsc: { label: 'Search Console', cta: 'Open Console', Icon: KeyRound, color: 'bg-slate-100 text-slate-700' },
  google_ads: { label: 'Google Ads', cta: 'View account', Icon: Megaphone, color: 'bg-blue-100 text-blue-700' },
  lsa: { label: 'Local Service Ads', cta: 'View account', Icon: Megaphone, color: 'bg-emerald-100 text-emerald-700' },
  gmb: { label: 'Google Business', cta: 'View profile', Icon: MapPin, color: 'bg-(--color-llg-purple-100) text-(--color-llg-purple-800)' },
} as const

export function IntegrationsCard({ links }: { links: IntegrationLink[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Integrations</CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">
            Once your accounts are linked, you&apos;ll see direct click-out links here.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const { label, cta, Icon, color } = META[l.key]
              return (
                <li key={l.key}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-md border border-slate-100 p-3 transition-colors hover:border-(--color-llg-purple-100) hover:bg-(--color-llg-purple-50)"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0 leading-tight">
                      <div className="text-sm font-medium text-slate-900">{label}</div>
                      <div className="text-xs text-(--color-llg-purple-700) group-hover:underline">
                        {cta}
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
