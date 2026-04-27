// Google PageSpeed Insights v5 client.
// Free tier — 25,000 queries/day. We hit ~18 queries/week (6 clients × 3
// pages × 2 strategies / 7 days) so quota is irrelevant.

export type PsiCategoryScore = number | null

export type PsiResult = {
  url: string
  strategy: 'mobile' | 'desktop'
  performance: PsiCategoryScore
  seo: PsiCategoryScore
  accessibility: PsiCategoryScore
  best_practices: PsiCategoryScore
  lcp_ms: number | null
  fid_ms: number | null   // INP since 2024 but field still labeled fid for back-compat
  cls: number | null
  opportunities: unknown[] | null
}

const BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

export async function fetchPsi(opts: {
  apiKey: string
  url: string
  strategy: 'mobile' | 'desktop'
}): Promise<PsiResult> {
  const params = new URLSearchParams({
    url: opts.url,
    strategy: opts.strategy,
    key: opts.apiKey,
  })
  for (const cat of ['performance', 'accessibility', 'seo', 'best-practices']) {
    params.append('category', cat)
  }

  const res = await fetch(`${BASE}?${params.toString()}`, {
    cache: 'no-store',
    // PSI requests can be slow (~30s for cold pages)
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PSI fetch failed (${res.status}): ${body.slice(0, 300)}`)
  }
  type Response = {
    lighthouseResult?: {
      categories?: Record<string, { score?: number | null }>
      audits?: Record<string, { numericValue?: number | null }>
    }
  }
  const json = (await res.json()) as Response

  const cats = json.lighthouseResult?.categories ?? {}
  const audits = json.lighthouseResult?.audits ?? {}

  const score = (k: string) => {
    const s = cats[k]?.score
    return s == null ? null : Math.round(s * 100)
  }

  return {
    url: opts.url,
    strategy: opts.strategy,
    performance: score('performance'),
    seo: score('seo'),
    accessibility: score('accessibility'),
    best_practices: score('best-practices'),
    lcp_ms: audits['largest-contentful-paint']?.numericValue ?? null,
    fid_ms: audits['interactive']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    opportunities: null, // skip detail for v1; can pull from audits later
  }
}
