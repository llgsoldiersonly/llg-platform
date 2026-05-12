// Maps package_deliverable.code → the 6 buckets the post-launch overview shows.
// Only matches recurring work — one-time setup items (PARENT_SEO_PAGES, CHILD_SEO_PAGES,
// directory bulk-builds done once) get filtered out by the period-window query in the
// page itself, not here.

import type { ProductionCategory } from '@/components/client/cards/monthly-production'

type CategoryKey = ProductionCategory['key']

// Order matches the whiteboard, top to bottom.
const CATEGORY_ORDER: CategoryKey[] = ['blogs', 'faqs', 'ai', 'social', 'gbp', 'links_citations']

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  blogs: 'Blogs',
  faqs: 'FAQs',
  ai: 'AI pages',
  social: 'Social posts',
  gbp: 'GBP posts',
  links_citations: 'Links / citations',
}

// Code-to-category routing. Order matters: first match wins, so place
// more specific patterns first (AI_BLOGS_EN_ES must match 'ai' before
// the general 'BLOG' pattern grabs it).
const ROUTERS: { test: (code: string) => boolean; bucket: CategoryKey }[] = [
  { test: (c) => c.startsWith('AI_') || c.includes('GEO_AI') || c.includes('VOICE_SEARCH'), bucket: 'ai' },
  { test: (c) => c.startsWith('BLOG_'), bucket: 'blogs' },
  { test: (c) => c.includes('FAQ'), bucket: 'faqs' },
  { test: (c) => c.startsWith('SOCIAL_'), bucket: 'social' },
  { test: (c) => c === 'GMB_POSTS' || c === 'GMB_VIDEO', bucket: 'gbp' },
  { test: (c) => c === 'LINK_BUILDING' || c.startsWith('NAP_') || c.includes('CITATION'), bucket: 'links_citations' },
]

export function routeDeliverableToCategory(code: string | null): CategoryKey | null {
  if (!code) return null
  for (const r of ROUTERS) {
    if (r.test(code)) return r.bucket
  }
  return null
}

export type RawProductionRow = {
  code: string | null
  target_count: number | null
  actual_count: number | null
}

export function aggregateProduction(rows: RawProductionRow[]): ProductionCategory[] {
  const buckets: Record<CategoryKey, { done: number; target: number }> = {
    blogs: { done: 0, target: 0 },
    faqs: { done: 0, target: 0 },
    ai: { done: 0, target: 0 },
    social: { done: 0, target: 0 },
    gbp: { done: 0, target: 0 },
    links_citations: { done: 0, target: 0 },
  }

  for (const row of rows) {
    const cat = routeDeliverableToCategory(row.code)
    if (!cat) continue
    buckets[cat].target += row.target_count ?? 0
    buckets[cat].done += row.actual_count ?? 0
  }

  return CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    done: buckets[key].done,
    target: buckets[key].target,
  }))
}
