// DataForSEO Google Business Profile (read-only) wrappers.
//
// Implementation note (2026-05-11): we route GBP-info lookups through
// /serp/google/maps/live/advanced (Google Maps SERP).
//
// What we tried that DIDN'T work:
//   1. /business_data/google/my_business_info/live → 404 (only exists as
//      task_post; polling adds cron complexity).
//   2. /business_data/business_listings/search/live → returns "Disco And
//      Karaoke" for every keyword (keyword filter is broken or stub).
//   3. /serp/google/local_finder/live/advanced with location_coordinate →
//      "No Search Results" for every call (Local Finder only accepts
//      location_name/code, not coordinates).
//
// Why Maps SERP works: takes location_coordinate as "lat,lng,zoom" and
// returns the maps_search items visible at that map view, including each
// listing's rating + reviews_count. matchLocalResult (in local.ts) already
// handles type='maps_search' items. Cost: ~$0.002/call. No polling.
//
// What we lose vs the task-based GBP endpoint: photos count, hours, category.
// The /overview GBP card only renders stars + review count + posts_30d, so
// those losses don't affect the user-facing surface.
//
// GBP "updates" (recent posts content) are still deferred — DataForSEO only
// exposes them via task_post pattern, which belongs in a future monthly cron.

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

type LookupArgs = {
  firmName: string
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
    },
    { client_id: opts.client_id }
  )

  // matchLocalResult sets client_rank_group when it finds a match.
  // Prefer that result; fall back to the top result whose title contains
  // the firm name (case-insensitive).
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

// GBP Posts ("Updates") — only available via DataForSEO's task-based
// my_business_updates endpoint. Returning empty for v1 keeps the cron
// synchronous; the /overview GBP card renders gracefully without the
// "latest post" block when posts_30d is 0.
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

// Stable id for an update: prefer uri (Google's canonical post URL); else hash
// the datetime + first 80 chars of snippet so re-syncs deduplicate.
export function gmbUpdateExternalId(u: GmbUpdate): string {
  if (u.uri) return u.uri
  const seed = `${u.datetime ?? ''}|${(u.snippet ?? '').slice(0, 80)}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return `gbp_${Math.abs(h)}`
}
