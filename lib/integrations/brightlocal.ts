// Unified BrightLocal client. Spans:
//  - Rank Tracker (LSRC): keyword positions across Google + Bing
//  - Citation Tracker: NAP health + correct/incorrect/missing dirs
//  - Reputation Manager: reviews across Google, Avvo, Martindale, etc.
//
// All three use the same BRIGHTLOCAL_API_KEY (Manage plan required for
// Reputation Manager). Auth is via api-key query param OR header
// depending on endpoint family.

const V2_BASE = 'https://tools.brightlocal.com/seo-tools/api'

type FetchOpts = { method?: 'GET' | 'POST'; body?: Record<string, unknown> }

async function blFetch<T>(path: string, apiKey: string, opts: FetchOpts = {}): Promise<T> {
  const url = new URL(`${V2_BASE}${path}`)
  url.searchParams.set('api-key', apiKey)
  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'LLG-Platform/1.0' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`BrightLocal ${path} (${res.status}): ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

// =====================================================================
// RANK TRACKER (LSRC — Local Search Rank Checker)
// =====================================================================

export type RankTrackerResult = {
  keyword: string
  positions: {
    google?: number | null
    google_mobile?: number | null
    google_local_finder?: number | null
    bing?: number | null
  }
  last_position_google?: number | null
  url?: string | null
}

export async function getRankTrackerResults(
  apiKey: string,
  campaignId: string
): Promise<RankTrackerResult[]> {
  // /v2/lsrc/results/get returns the latest tracked positions for a campaign
  type Response = {
    response?: {
      result?: {
        rankings?: Record<string, Record<string, Array<{ rank?: number | null; url?: string | null }>>>
      }
    }
  }
  const json = await blFetch<Response>(`/v2/lsrc/results/get?campaign-id=${encodeURIComponent(campaignId)}`, apiKey)

  const rankings = json.response?.result?.rankings ?? {}
  const out: RankTrackerResult[] = []
  for (const [keyword, engineMap] of Object.entries(rankings)) {
    const result: RankTrackerResult = {
      keyword,
      positions: {
        google: engineMap.google?.[0]?.rank ?? null,
        google_mobile: engineMap.google_mobile?.[0]?.rank ?? null,
        google_local_finder: engineMap.google_local_finder?.[0]?.rank ?? null,
        bing: engineMap.bing?.[0]?.rank ?? null,
      },
      url: engineMap.google?.[0]?.url ?? null,
    }
    out.push(result)
  }
  return out
}

// =====================================================================
// CITATION TRACKER
// =====================================================================

export type CitationTrackerResult = {
  health_score: number | null
  correct_count: number | null
  incorrect_count: number | null
  missing_count: number | null
  directories: unknown
  ai_fixes: unknown
}

export async function getCitationTrackerResults(
  apiKey: string,
  reportId: string
): Promise<CitationTrackerResult | null> {
  type Response = {
    response?: {
      result?: {
        active?: unknown[]
        possible?: unknown[]
        nap_comparison?: unknown[]
        active_count?: number
        incorrect_count?: number
        possible_count?: number
        topDirectories?: unknown[]
      }
    }
  }
  const json = await blFetch<Response>(`/v2/ct/get-results?report-id=${encodeURIComponent(reportId)}`, apiKey)
  const r = json.response?.result
  if (!r) return null
  const active = r.active_count ?? (r.active?.length ?? 0)
  const incorrect = r.incorrect_count ?? 0
  const missing = r.possible_count ?? (r.possible?.length ?? 0)
  const total = active + incorrect + missing
  const health = total > 0 ? Math.round((active / total) * 100) : null
  return {
    health_score: health,
    correct_count: active,
    incorrect_count: incorrect,
    missing_count: missing,
    directories: r.topDirectories ?? null,
    ai_fixes: r.nap_comparison ?? null,
  }
}

// =====================================================================
// REPUTATION MANAGER (reviews)
// =====================================================================

export type ReviewItem = {
  directory: string
  external_review_id: string | null
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_date: string | null
  response_text: string | null
  response_date: string | null
  review_url: string | null
  raw: unknown
}

export async function getReputationManagerResults(
  apiKey: string,
  reportId: string
): Promise<ReviewItem[]> {
  type RawReview = {
    id?: string
    reviewer?: string
    rating?: number
    review?: string
    review_text?: string
    date?: string
    review_date?: string
    response?: string
    response_date?: string
    url?: string
    review_url?: string
  }
  type Response = {
    response?: {
      result?: {
        reviews_by_directory?: Record<string, { reviews?: RawReview[] }>
      }
    }
  }
  const json = await blFetch<Response>(`/v2/rm/get-results?report-id=${encodeURIComponent(reportId)}`, apiKey)
  const byDir = json.response?.result?.reviews_by_directory ?? {}

  const out: ReviewItem[] = []
  for (const [directory, payload] of Object.entries(byDir)) {
    for (const r of payload.reviews ?? []) {
      out.push({
        directory,
        external_review_id: r.id ?? null,
        reviewer_name: r.reviewer ?? null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        review_text: r.review_text ?? r.review ?? null,
        review_date: r.review_date ?? r.date ?? null,
        response_text: r.response ?? null,
        response_date: r.response_date ?? null,
        review_url: r.review_url ?? r.url ?? null,
        raw: r,
      })
    }
  }
  return out
}

// =====================================================================
// LOOKUP HELPERS for setup script (Phase 7 first-run)
// =====================================================================

export type CitationReportSubmitResponse = {
  response?: { result?: { 'report-id'?: string | number } }
}

// Triggers a fresh Citation Tracker report. Returns the report_id once
// the job is queued. Polling for completion is handled by the cron.
export async function submitCitationReport(
  apiKey: string,
  payload: {
    business_name: string
    address: string
    city: string
    state: string
    postcode?: string
    country?: string
    website?: string
    phone?: string
  }
): Promise<string> {
  const json = await blFetch<CitationReportSubmitResponse>(`/v2/ct/create`, apiKey, {
    method: 'POST',
    body: payload,
  })
  const id = json.response?.result?.['report-id']
  if (!id) throw new Error('Citation Tracker create returned no report-id')
  return String(id)
}
