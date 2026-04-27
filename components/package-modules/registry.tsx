import { ModuleCard } from './module-card'

type ModuleProps = {
  config: Record<string, unknown>
  deliverables: React.ComponentProps<typeof ModuleCard>['deliverables']
}

// Each module is a thin wrapper around ModuleCard. Phase 4 ships these as
// "deliverables-only" stubs; Phase 6+ will inject charts, post lists, call
// logs, ranking trends, etc.
export function SeoModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="SEO Plan"
      subtitle="On-page optimization, technical SEO, and content backbone"
      phase="Phase 7"
      {...props}
    />
  )
}

export function LocalModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="Local Plan"
      subtitle="Google Business Profile, citations, NAP, and local maps"
      phase="Phase 8"
      {...props}
    />
  )
}

export function PpcModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="Paid Ads"
      subtitle="Google Ads / LSA campaigns, retargeting, lead funnels"
      phase="Phase 14 (v1.6)"
      {...props}
    />
  )
}

export function ContentModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="Content"
      subtitle="Blogs, videos, press releases (English + Spanish)"
      phase="Phase 6"
      {...props}
    />
  )
}

export function AiVoiceModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="AI / Voice Search"
      subtitle="FAQ voice search blogs + AI submissions to ChatGPT, Perplexity, etc."
      phase="Phase 6"
      {...props}
    />
  )
}

export function IntakesModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="Live Intakes"
      subtitle="24/7 bilingual call answering and lead verification"
      phase="Phase 6"
      {...props}
    />
  )
}

export function KeywordsReadonlyModule(props: ModuleProps) {
  return (
    <ModuleCard
      title="Keywords (read-only)"
      subtitle="Tracked keyword positions across Google + Bing — no editing"
      phase="Phase 7"
      {...props}
    />
  )
}

const components = {
  SEO_PLAN: SeoModule,
  LOCAL_PLAN: LocalModule,
  PPC: PpcModule,
  CONTENT: ContentModule,
  AI_VOICE: AiVoiceModule,
  INTAKES: IntakesModule,
  KEYWORDS_READONLY: KeywordsReadonlyModule,
} as const

export type ModuleCode = keyof typeof components

export function getModuleComponent(code: string) {
  return components[code as ModuleCode]
}

export const MODULE_RENDER_ORDER: ModuleCode[] = [
  'SEO_PLAN',
  'LOCAL_PLAN',
  'KEYWORDS_READONLY',
  'CONTENT',
  'AI_VOICE',
  'PPC',
  'INTAKES',
]
