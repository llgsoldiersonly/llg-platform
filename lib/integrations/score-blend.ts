// Performance scoring + CrUX/lab blending.
//
// Lighthouse's Performance score (0-100) is a weighted geometric-style average
// of individual metric scores. Each metric's 0-1 score is the log-normal CDF
// of its value, anchored at (p10=0.90, median=0.50). The anchors are published
// by the Lighthouse team and differ for mobile vs desktop.
//
// CrUX doesn't natively give you a 0-100; it gives you raw p75 timings + a
// FAST/AVERAGE/SLOW bucket. To produce a "field-equivalent score" we feed the
// CrUX p75 values through the same scoring curves Lighthouse uses, then
// weight-average with the lab score using `crux_weight` from platform_settings.
//
// Sources:
// - Curves: https://github.com/GoogleChrome/lighthouse/blob/main/core/config/default-config.js
// - v10 weights: https://web.dev/articles/performance-scoring

// Abramowitz & Stegun 7.1.26 approximation of the error function. Max error
// ≈ 1.5e-7 — more than enough precision for a 0-100 score.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const p = 0.3275911
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const t = 1 / (1 + p * a)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-a * a)
  return sign * y
}

// Curve anchors for each metric, per strategy. Values from Lighthouse v10+.
// median = the value at which the metric scores 0.50
// p10    = the value at which the metric scores 0.90
type Anchor = { median: number; p10: number }

const CURVES: Record<'mobile' | 'desktop', Record<'lcp' | 'inp' | 'cls' | 'fcp', Anchor>> = {
  mobile: {
    lcp: { p10: 2500, median: 4000 },
    inp: { p10: 200, median: 500 },
    cls: { p10: 0.1, median: 0.25 },
    fcp: { p10: 1800, median: 3000 },
  },
  desktop: {
    lcp: { p10: 1200, median: 2400 },
    inp: { p10: 200, median: 500 },
    cls: { p10: 0.1, median: 0.25 },
    fcp: { p10: 934, median: 1600 },
  },
}

// Lighthouse v10 metric weights for the Performance category.
// FCP+LCP+CLS+TBT(=INP in field)+SI together sum to 100 in lab. Since CrUX
// doesn't expose Speed Index, we renormalize over the 4 metrics we DO get
// from CrUX (FCP, LCP, INP, CLS). The weights below are the v10 weights with
// SI removed and the remainder renormalized to sum to 1.
//
//   Lab weights: FCP 10, SI 10, LCP 25, TBT/INP 30, CLS 25  →  total 100
//   CrUX-equivalent: FCP 10, LCP 25, INP 30, CLS 25         →  total 90
//   Renormalized:    FCP 0.111, LCP 0.278, INP 0.333, CLS 0.278
const WEIGHTS = { fcp: 10 / 90, lcp: 25 / 90, inp: 30 / 90, cls: 25 / 90 } as const

// Log-normal CDF as Lighthouse implements it. Maps a metric value to a 0-1
// score that hits 0.90 at p10 and 0.50 at median.
function logNormalScore({ median, p10 }: Anchor, value: number): number {
  if (value <= 0) return 1
  const location = Math.log(median)
  // The shape parameter is chosen so that score(p10) = 0.90.
  // erfcInv(2 * 0.9) = 0.9061938... — Lighthouse hardcodes this constant.
  const SHAPE_SCALE = 0.9061938024368232 // = erfcInv(2 * 0.9)
  const shape = Math.abs(Math.log(p10) - location) / (Math.SQRT2 * SHAPE_SCALE)
  const standardized = (Math.log(value) - location) / (Math.SQRT2 * shape)
  // Lighthouse uses 0.5 * erfc(x) = 1 - Φ(x*√2) for the upper-tail.
  // erfc(x) = 1 - erf(x), so 0.5 * erfc(standardized) = 0.5 * (1 - erf(standardized))
  const score = 0.5 * (1 - erf(standardized))
  return Math.max(0, Math.min(1, score))
}

// Compute a 0-100 score from a set of metrics + strategy curves.
// Any metric that's null is excluded and remaining weights are renormalized.
function compositeScore(
  strategy: 'mobile' | 'desktop',
  m: { lcp?: number | null; inp?: number | null; cls?: number | null; fcp?: number | null }
): number | null {
  const curves = CURVES[strategy]
  const parts: Array<{ score: number; weight: number }> = []
  if (m.fcp != null) parts.push({ score: logNormalScore(curves.fcp, m.fcp), weight: WEIGHTS.fcp })
  if (m.lcp != null) parts.push({ score: logNormalScore(curves.lcp, m.lcp), weight: WEIGHTS.lcp })
  if (m.inp != null) parts.push({ score: logNormalScore(curves.inp, m.inp), weight: WEIGHTS.inp })
  if (m.cls != null) parts.push({ score: logNormalScore(curves.cls, m.cls), weight: WEIGHTS.cls })
  if (parts.length === 0) return null
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
  const weighted = parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight
  return Math.round(weighted * 100)
}

export type LabMetrics = {
  performance: number | null // 0-100 from Lighthouse
  lcp_ms: number | null
  fid_ms: number | null // TTI, but we still call it fid_ms for back-compat with the schema
  cls: number | null
}

export type CruxMetrics = {
  lcp_ms: number | null
  inp_ms: number | null
  cls: number | null
  fcp_ms: number | null
}

export type BlendedDisplay = {
  // The number the card shows in big type.
  displayed_score: number | null
  // Where the displayed number came from.
  source: 'crux_only' | 'lab_only' | 'blended'
  // The two source scores, exposed for the tooltip and admin debug view.
  crux_score: number | null
  lab_score: number | null
  // Per-metric blended values (same blend weighting). Null when not applicable.
  blended_lcp_ms: number | null
  blended_cls: number | null
}

export function blendSiteHealth(
  strategy: 'mobile' | 'desktop',
  lab: LabMetrics,
  crux: CruxMetrics,
  cruxWeight: number
): BlendedDisplay {
  const cruxScore = compositeScore(strategy, {
    lcp: crux.lcp_ms,
    inp: crux.inp_ms,
    cls: crux.cls,
    fcp: crux.fcp_ms,
  })
  const labScore = lab.performance

  const hasCrux = cruxScore != null
  const hasLab = labScore != null

  let displayed: number | null
  let source: BlendedDisplay['source']
  if (hasCrux && hasLab) {
    displayed = Math.round(cruxWeight * cruxScore + (1 - cruxWeight) * labScore)
    source = 'blended'
  } else if (hasCrux) {
    displayed = cruxScore
    source = 'crux_only'
  } else if (hasLab) {
    displayed = labScore
    source = 'lab_only'
  } else {
    displayed = null
    source = 'lab_only'
  }

  const blendOne = (cruxVal: number | null, labVal: number | null): number | null => {
    if (cruxVal != null && labVal != null) {
      return Math.round(cruxWeight * cruxVal + (1 - cruxWeight) * labVal)
    }
    return cruxVal ?? labVal ?? null
  }

  return {
    displayed_score: displayed,
    source,
    crux_score: cruxScore,
    lab_score: labScore,
    blended_lcp_ms: blendOne(crux.lcp_ms, lab.lcp_ms),
    blended_cls: (() => {
      if (crux.cls != null && lab.cls != null) {
        return cruxWeight * crux.cls + (1 - cruxWeight) * lab.cls
      }
      return crux.cls ?? lab.cls ?? null
    })(),
  }
}
