// DataForSEO Google Business Profile (read-only) wrappers.
//
// Implementation note (2026-05-11, third try):
//
// We route lookups through /serp/google/maps/live/advanced with the firm's
// office lat/lng as `location_coordinate` and (when available) the firm's
// Google Place ID as the matcher key. Maps SERP returns up to 100 nearby
// businesses including their place_id, rating, and review count per item.
// matchLocalResult in local.ts now prefers place_id match (exact, unique)
// over domain or name.
//
// What we tried that DIDN'T work:
//   - /business_data/google/my_business_info/live → 404 (no /live variant)
//   - /business_data/google/my_business_info/task_post → requires `keyword`,
//     does NOT accept place_id alone. Confirmed 2026-05-11 with
//     "Invalid Field: 'keyword'" error response.
//   - /business_data/business_listings/search/live → returns "Disco And
//     Karaoke" for every keyword (broken keyword filter).
//   - /serp/google/local_finder/live/advanced with location_coordinate →
//     "No Search Results" (Local Finder only accepts location_name/code).
//
// Why Maps SERP + place_id is correct: synchronous (no task polling), one
// API call per location ($0.002), Maps result items include place_id so
// matching is exact-1-to-1. The firm just needs to be in the top-100
// listings for its area (broader zoom helps).

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
  /** Preferred matcher when available — globally unique, exact match. */
  placeId?: string | null
  /** Secondary matcher — pretty unique, no name collisions. */
  primaryDomain?: string | null
  lat: number
  lng: number
  /** Google Maps zoom level. Lower = broader area. 12 ≈ city; 14 = few blocks.
   *  Defaults to 12 so the firm's GBP is more likely to be in the top 100. */
  zoom?: number
}

export async function getGmbInfo(args: LookupArgs, opts: Opts = {}): Promise<GmbInfoResult | null> {
  const result = await getGoogleMapsRankAtPoint(
    {
      keyword: args.firmName,
      lat: args.lat,
      lng: args.lng,
      zoom: args.zoom ?? 12,
      businessName: args.firmName,
      clientDomain: args.primaryDomain ?? undefined,
      clientPlaceId: args.placeId ?? undefined,
    },
    { client_id: opts.client_id }
  )

  // Find the matched item. matchLocalResult's match priority is place_id >
  // domain > name. The matched result's rank_group is exposed as
  // client_rank_group; look it up in top_results to get rating/reviews.
  const match = result.client_rank_group
    ? result.top_results.find((r) => r.rank_group === result.client_rank_group)
    : null

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
    place_id: match.place_id ?? undefined,
  }
}

// GBP Posts ("Updates") — DataForSEO's my_business_updates endpoint is on a
// gated subscription tier (~$100+/mo, declined 2026-05-13). And Google
// Business Profile API's localPosts endpoint requires per-firm OAuth that
// Nathan hasn't set up. So we get GBP posts from a different source
// entirely: staff submissions (`deliverable_submissions` rows with
// kind='gmb_post'). The portal overview page reads from there directly;
// this wrapper stays as a stub for API-shape compatibility.
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
