// Google PageSpeed Insights v5 client.
// Free tier — 25,000 queries/day. We hit ~18 queries/week (6 clients × 3
// pages × 2 strategies / 7 days) so quota is irrelevant.

export type PsiCategoryScore = number | null

export type PsiCrux = {
  lcp_ms: number | null
  inp_ms: number | null
  cls: number | null
  fcp_ms: number | null
  category: 'FAST' | 'AVERAGE' | 'SLOW' | null
}

export type PsiResult = {
  url: string
  strategy: 'mobile' | 'desktop'
  performance: PsiCategoryScore
  seo: PsiCategoryScore
  accessibility: PsiCategoryScore
  best_practices: PsiCategoryScore
  lcp_ms: number | null
  fid_ms: number | null   // TTI in the schema; v10 dropped FID. Real INP lives on PsiResult.crux.
  cls: number | null
  opportunities: unknown[] | null
  // Real-user p75 values from Chrome User Experience Report (last 28 days).
  // Null when the URL/origin doesn't have enough qualifying traffic. PSI
  // returns both URL-level (loadingExperience) and origin-level
  // (originLoadingExperience); URL is more specific, origin is more likely
  // to have data — we prefer URL when present and fall back to origin.
  crux: PsiCrux
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
  type CruxBlock = {
    overall_category?: 'FAST' | 'AVERAGE' | 'SLOW'
    metrics?: Record<string, { percentile?: number }>
  }
  type Response = {
    lighthouseResult?: {
      categories?: Record<string, { score?: number | null }>
      audits?: Record<string, { numericValue?: number | null }>
    }
    loadingExperience?: CruxBlock        // URL-level (more specific)
    originLoadingExperience?: CruxBlock  // Origin-level (more common)
  }
  const json = (await res.json()) as Response

  const cats = json.lighthouseResult?.categories ?? {}
  const audits = json.lighthouseResult?.audits ?? {}

  const score = (k: string) => {
    const s = cats[k]?.score
    return s == null ? null : Math.round(s * 100)
  }

  // Prefer URL-level CrUX; fall back to origin-level when URL data isn't available.
  const urlCrux = json.loadingExperience
  const originCrux = json.originLoadingExperience
  const cruxSrc: CruxBlock | undefined =
    urlCrux?.metrics?.LARGEST_CONTENTFUL_PAINT_MS ? urlCrux : originCrux
  const cruxMetric = (k: string) => cruxSrc?.metrics?.[k]?.percentile ?? null

  // CrUX returns CLS as integer*100 (e.g. 23 = 0.23). Normalize back to a 0-1 scale.
  const cruxClsRaw = cruxMetric('CUMULATIVE_LAYOUT_SHIFT_SCORE')
  const cruxCls = cruxClsRaw != null ? cruxClsRaw / 100 : null

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
    opportunities: null,
    crux: {
      lcp_ms: cruxMetric('LARGEST_CONTENTFUL_PAINT_MS'),
      inp_ms: cruxMetric('INTERACTION_TO_NEXT_PAINT'),
      cls: cruxCls,
      fcp_ms: cruxMetric('FIRST_CONTENTFUL_PAINT_MS'),
      category: cruxSrc?.overall_category ?? null,
    },
  }
}
