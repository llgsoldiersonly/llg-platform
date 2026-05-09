// DataForSEO Google Business Profile (read-only) wrappers.
//
// Endpoints:
//   /business_data/business_listings/search/live   — listing details (LIVE)
//   /business_data/google/my_business_updates/...  — only exists in task-based
//                                                     form, deferred for v1
//
// Why /business_listings/search instead of /my_business_info?
//   The /my_business_info endpoint only exists at /task_post (queue-based);
//   there's no /live variant — calling /live returns HTTP 404. The
//   /business_listings/search/live endpoint returns the same fields
//   synchronously, so it's the right primitive for an in-cron call.
//
// Lookup args:
//   - place_id (preferred — most precise; populated from
//     client_locations.gbp_place_id when set)
//   - lat/lng coordinate (fallback — uses location_coordinate "lat,lng,radius_m"
//     which works regardless of how DataForSEO indexes locality names)

import { dataForSeoPost, getFirstResult, type DataForSeoTask } from './client'

type LookupArgs =
  | { placeId: string; keyword?: string }
  | { keyword: string; lat: number; lng: number; radiusMeters?: number }

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

type SearchTaskResult = {
  items_count: number
  items: GmbInfoResult[]
}

// /business_data/business_listings/search/live
//
// Search keyword required. When place_id is given we still need a keyword
// (DataForSEO uses keyword to filter even when narrowing by place_id), so
// we fall back to the firm name as the keyword. Coordinate or place_id
// scope the search.
export async function getGmbInfo(args: LookupArgs, opts: Opts = {}): Promise<GmbInfoResult | null> {
  const task: Record<string, unknown> = {}

  if ('placeId' in args) {
    // place_id-based filtering on the search endpoint
    task.keyword = args.keyword ?? '*'
    task.filters = [['place_id', '=', args.placeId]]
    task.limit = 1
  } else {
    task.keyword = args.keyword
    task.location_coordinate = `${args.lat},${args.lng},${args.radiusMeters ?? 5000}`
    task.limit = 1
  }

  const res = await dataForSeoPost<SearchTaskResult>(
    '/business_data/business_listings/search/live',
    task,
    { client_id: opts.client_id, request_tag: 'gmb_info' }
  )
  const first = getFirstResult(res) as SearchTaskResult | null
  return first?.items?.[0] ?? null
}

// GBP Posts ("Updates") — DataForSEO only exposes this via the task-queue
// pattern (no /live). For v1 we skip post fetching and return an empty array.
// The GBP card on /overview gracefully handles empty (no "Latest post" block
// renders); rating + review count + photos still populate from getGmbInfo.
//
// Future work: implement task_post -> tasks_ready -> task_get pattern in a
// separate "monthly finalize" cron so we don't have to poll inside the
// weekly serverless time budget.
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

export type _GmbTaskBag = DataForSeoTask<unknown>
