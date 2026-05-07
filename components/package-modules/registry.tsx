import { ModuleSection } from './module-section'

type ModuleProps = {
  config: Record<string, unknown>
  deliverables: React.ComponentProps<typeof ModuleSection>['deliverables']
  hideWhenEmpty?: boolean
}

// Each module is a thin wrapper around ModuleSection. Phase 4 ships these
// as "deliverables-only" stubs; Phase 6+ will inject charts, post lists,
// call logs, ranking trends, etc.
export function SeoModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="SEO Plan"
      subtitle="On-page optimization, technical SEO, and content backbone"
      {...props}
    />
  )
}

export function LocalModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="Local Plan"
      subtitle="Google Business Profile, citations, NAP, and local maps"
      {...props}
    />
  )
}

export function PpcModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="Paid Ads"
      subtitle="Google Ads / LSA campaigns, retargeting, lead funnels"
      {...props}
    />
  )
}

export function ContentModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="Content"
      subtitle="Blogs, videos, press releases (English + Spanish)"
      {...props}
    />
  )
}

export function AiVoiceModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="AI / Voice Search"
      subtitle="FAQ voice search blogs + AI submissions to ChatGPT, Perplexity, etc."
      {...props}
    />
  )
}

export function IntakesModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="Live Intakes"
      subtitle="24/7 bilingual call answering and lead verification"
      {...props}
    />
  )
}

export function KeywordsReadonlyModule(props: ModuleProps) {
  return (
    <ModuleSection
      title="Keywords (read-only)"
      subtitle="Tracked keyword positions across Google + Bing — no editing"
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
