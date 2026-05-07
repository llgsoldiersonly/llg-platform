import { Card, CardContent } from '@/components/ui/card'
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Search,
  Phone,
  ArrowUpRight,
  Download,
  Presentation,
  Network,
  LayoutGrid,
} from 'lucide-react'

const PPTX_FILENAME = 'Lucrative Legal — 5 Pillars of Multichannel Marketing for Attorneys.pptx'
const PPTX_HREF = `/multichannel-marketing/${encodeURIComponent(PPTX_FILENAME)}`

const PILLARS = [
  { name: 'AI Search',  Icon: Sparkles,    color: '#f56bf4' },
  { name: 'Google Ads', Icon: TrendingUp,  color: '#9439EE' },
  { name: 'LSAs',       Icon: ShieldCheck, color: '#0BBFFF' },
  { name: 'SEO',        Icon: Search,      color: '#FFB60C' },
  { name: 'Intake',     Icon: Phone,       color: '#C071E0' },
] as const

const FORMATS = [
  {
    label: 'Slide Deck',
    sub: '14 slides',
    href: '/multichannel-marketing/slide-deck.html',
    Icon: Presentation,
    color: '#f56bf4',
  },
  {
    label: 'Mindmap',
    sub: '5 pillars',
    href: '/multichannel-marketing/mindmap.html',
    Icon: Network,
    color: '#9439EE',
  },
  {
    label: 'Infographic',
    sub: 'Single page',
    href: '/multichannel-marketing/infographic.html',
    Icon: LayoutGrid,
    color: '#FFB60C',
  },
] as const

export function ResourcesCard() {
  return (
    <Card className="overflow-hidden p-0">
      {/* Brand hero strip — Lucrative Legal gradient */}
      <div
        className="relative px-5 py-5 text-white"
        style={{ background: 'linear-gradient(135deg, #500BA9 0%, #9439EE 55%, #f56bf4 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 80% at 100% 0%, rgba(255,182,12,0.35) 0%, transparent 60%)',
          }}
        />
        <div className="relative">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">
            Multichannel Marketing · 5 Pillars
          </div>
          <h3 className="mt-1.5 text-xl font-bold leading-tight">
            The Connected Pipeline for Law Firms
          </h3>
          <p className="mt-2 text-sm font-medium text-white leading-snug">
            Source-grounded playbook
          </p>
        </div>
      </div>

      <CardContent className="space-y-4 pt-4">
        {/* Primary CTA → resource hub (now points at the explicit index.html) */}
        <a
          href="/multichannel-marketing/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between rounded-lg p-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #500BA9 0%, #9439EE 100%)' }}
        >
          <span>Open the Resource Hub</span>
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        {/* Slide Deck / Mindmap / Infographic — now visually dominant: colored
            backgrounds with icons + sub-label. */}
        <ul className="grid grid-cols-3 gap-2">
          {FORMATS.map(({ label, sub, href, Icon, color }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-full flex-col gap-2 rounded-lg border border-border-light p-3 transition-all hover:-translate-y-0.5 hover:border-border-brand-subtle hover:bg-neutral-tertiary-soft"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ background: color, color: '#1c1134' }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-bold leading-tight text-heading">{label}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color }}>
                    {sub}
                  </div>
                </div>
                <ArrowUpRight
                  className="absolute right-2 top-2 h-3.5 w-3.5 text-body transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            </li>
          ))}
        </ul>

        {/* 5 pillar chips — now BELOW the Slide Deck row, no hover effect */}
        <div className="grid grid-cols-5 gap-2">
          {PILLARS.map(({ name, Icon, color }) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1.5 rounded-md border border-border-light p-2 text-center"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: `${color}1f`, color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[10px] font-medium leading-tight text-heading">{name}</span>
            </div>
          ))}
        </div>

        {/* PPTX — now opens in a new tab on llgportal (Office for the web /
            macOS Quick Look will preview; users can still File > Save if they
            want a copy). No `download` attribute so the browser respects the
            target="_blank" behavior. */}
        <a
          href={PPTX_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border border-dashed border-border-light px-3 py-2 text-xs text-body hover:border-border-brand-subtle hover:text-fg-brand"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Lucrative Legal — 5 Pillars (.pptx)</span>
        </a>
      </CardContent>
    </Card>
  )
}
