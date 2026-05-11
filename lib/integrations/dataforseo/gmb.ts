// DataForSEO Google Business Profile (read-only) wrappers.
//
// Two lookup paths, chosen per-location based on what data we have:
//
// 1. PRIMARY: by place_id (or CID) via the task-based my_business_info
//    endpoint. Used when client_locations.gbp_place_id is set. 1-to-1
//    match, returns full listing detail (rating, reviews, photos,
//    hours, category, etc.). Requires task_post → wait → task_get
//    pattern; ~10–20s round trip with priority=2.
//
// 2. FALLBACK: by firm_name + lat/lng via the live Maps SERP endpoint.
//    Used when no place_id is set. Subject to false-positive matches
//    when the firm name collides with unrelated businesses (e.g.,
//    "Dooley Noted" → "Dooley Noted Skin Spa Co." in Austin), so we
//    also pass primary_domain to disambiguate.
//
// What we tried that DIDN'T work (see commit history for details):
//   - /business_data/google/my_business_info/live → 404 (no /live variant)
//   - /business_data/business_listings/search/live → returns junk regardless
//     of keyword filter ("Disco And Karaoke" for every law-firm query)
//   - /serp/google/local_finder/live/advanced with location_coordinate →
//     "No Search Results" (Local Finder only accepts location_name/code)
//
// GBP "updates" (recent posts content) are still deferred — DataForSEO only
// exposes them via task_post pattern; queued for a future monthly cron.

import {
  dataForSeoPost,
  dataForSeoGet,
  getFirstResult,
} from './client'
import { getGoogleMapsRankAtPoint } from './local'

type Opts = { client_id?: string | null }

export type GmbInfoResult = {
  type: string
  title?: string
  rating?: { value?: number; votes_count?: number; rating_type?: string }
  category?: string
  categories?: string[]
  phone?: string
  url?: string
  address?: string
  address_info?: Record<string, unknown>
  work_hours?: Record<string, unknown>
  work_time?: Record<string, unknown>
  place_id?: string
  cid?: string
  main_image_url?: string
  total_photos?: number
  is_claimed?: boolean
}

// ---------------------------------------------------------------
// PRIMARY PATH — by place_id via task-based my_business_info.
//
// Use submit + fetch in batch from the caller: submit all tasks in
// parallel, sleep ~12s, fetch all results in parallel. With priority=2
// DataForSEO usually returns within 5–10s; the 12s buffer is safe.
// ---------------------------------------------------------------

type SubmitArgs = {
  placeId?: string
  cid?: string | number
  languageCode?: string
}

/**
 * POST /v3/business_data/google/my_business_info/task_post
 * Returns DataForSEO task_id (or null if submission failed at the API level).
 */
export async function submitGmbInfoTask(args: SubmitArgs, opts: Opts = {}): Promise<string | null> {
  const task: Record<string, unknown> = {
    priority: 2, // HIGH — DataForSEO processes within seconds
    language_code: args.languageCode ?? 'en',
  }
  if (args.placeId) task.place_id = args.placeId
  else if (args.cid != null) task.cid = String(args.cid)
  else return null

  try {
    const res = await dataForSeoPost(
      '/business_data/google/my_business_info/task_post',
      task,
      { client_id: opts.client_id, request_tag: 'gmb_info_post' }
    )
    return res.tasks?.[0]?.id ?? null
  } catch {
    return null
  }
}

/**
 * GET /v3/business_data/google/my_business_info/task_get/{task_id}
 * Returns the listing info if ready; null if not ready / not found / errored.
 */
export async function fetchGmbInfoTask(
  taskId: string,
  opts: Opts = {}
): Promise<GmbInfoResult | null> {
  try {
    const res = await dataForSeoGet<{ items?: GmbInfoResult[] }>(
      `/business_data/google/my_business_info/task_get/${taskId}`,
      { client_id: opts.client_id, request_tag: 'gmb_info_get' }
    )
    const result = getFirstResult(res) as { items?: GmbInfoResult[] } | null
    return result?.items?.[0] ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// FALLBACK PATH — by firm_name + lat/lng via Maps SERP.
// Used when no place_id is set on client_locations.
// ---------------------------------------------------------------

type LookupArgs = {
  firmName: string
  primaryDomain?: string | null
  lat: number
  lng: number
  /** Google Maps zoom level. 12 ≈ "city neighborhood"; 14 = "few blocks". */
  zoom?: number
}

export async function getGmbInfo(args: LookupArgs, opts: Opts = {}): Promise<GmbInfoResult | null> {
  const result = await getGoogleMapsRankAtPoint(
    {
      keyword: args.firmName,
      lat: args.lat,
      lng: args.lng,
      zoom: args.zoom ?? 14,
      businessName: args.firmName,
      clientDomain: args.primaryDomain ?? undefined,
    },
    { client_id: opts.client_id }
  )

  const byRank = result.client_rank_group
    ? result.top_results.find((r) => r.rank_group === result.client_rank_group)
    : null
  const byName = result.top_results.find((r) =>
    (r.title ?? '').toLowerCase().includes(args.firmName.toLowerCase())
  )
  const match = byRank ?? byName ?? null

  if (!match) return null

  return {
    type: 'business_data',
    title: match.title ?? undefined,
    rating:
      match.rating != null || match.reviews_count != null
        ? {
            value: match.rating ?? undefined,
            votes_count: match.reviews_count ?? undefined,
          }
        : undefined,
    url: match.url ?? undefined,
    address: match.address ?? undefined,
    phone: match.phone ?? undefined,
    cid: match.cid ?? undefined,
  }
}

// ---------------------------------------------------------------
// GBP Posts / "Updates" — deferred to future monthly cron.
// ---------------------------------------------------------------

export type GmbUpdate = {
  type: string
  snippet?: string
  image_url?: string
  datetime?: string
  uri?: string
}

export async function getGmbUpdates(_args: LookupArgs, _opts: Opts = {}): Promise<GmbUpdate[]> {
  return []
}

export function gmbUpdateExternalId(u: GmbUpdate): string {
  if (u.uri) return u.uri
  const seed = `${u.datetime ?? ''}|${(u.snippet ?? '').slice(0, 80)}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return `gbp_${Math.abs(h)}`
}
