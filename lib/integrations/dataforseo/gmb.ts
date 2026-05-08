// DataForSEO Google Business Profile (read-only) wrappers.
//
// Two endpoints, both lookup by `place_id` (preferred) or by keyword+location:
//   /business_data/google/my_business_info/live      — listing details
//   /business_data/google/my_business_updates/live   — recent GBP posts
//
// We pass `place_id` whenever client_locations.gbp_place_id is set; otherwise
// fall back to firm_name + city as keyword/location_name.

import { dataForSeoPost, getFirstResult, type DataForSeoTask } from './client'

type LookupArgs =
  | { placeId: string }
  | { keyword: string; locationName: string; languageCode?: string }

type Opts = { client_id?: string | null }

// ---------------------------------------------------------------
// /business_data/google/my_business_info/live
// ---------------------------------------------------------------
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

type InfoTaskResult = {
  items_count: number
  items: GmbInfoResult[]
}

export async function getGmbInfo(args: LookupArgs, opts: Opts = {}): Promise<GmbInfoResult | null> {
  const task: Record<string, unknown> = {}
  if ('placeId' in args) {
    task.place_id = args.placeId
  } else {
    task.keyword = args.keyword
    task.location_name = args.locationName
    task.language_code = args.languageCode ?? 'en'
  }
  const res = await dataForSeoPost<InfoTaskResult>(
    '/business_data/google/my_business_info/live',
    task,
    { client_id: opts.client_id, request_tag: 'gmb_info' }
  )
  const first = getFirstResult(res) as InfoTaskResult | null
  return first?.items?.[0] ?? null
}

// ---------------------------------------------------------------
// /business_data/google/my_business_updates/live
// ---------------------------------------------------------------
export type GmbUpdate = {
  type: string
  snippet?: string
  image_url?: string
  datetime?: string
  uri?: string
}

type UpdatesTaskResult = {
  items_count: number
  items: GmbUpdate[]
}

export async function getGmbUpdates(args: LookupArgs, opts: Opts = {}): Promise<GmbUpdate[]> {
  const task: Record<string, unknown> = {}
  if ('placeId' in args) {
    task.place_id = args.placeId
  } else {
    task.keyword = args.keyword
    task.location_name = args.locationName
    task.language_code = args.languageCode ?? 'en'
  }
  const res = await dataForSeoPost<UpdatesTaskResult>(
    '/business_data/google/my_business_updates/live',
    task,
    { client_id: opts.client_id, request_tag: 'gmb_updates' }
  )
  const first = getFirstResult(res) as UpdatesTaskResult | null
  return first?.items ?? []
}

// Stable id for an update: prefer uri (Google's canonical post URL); else hash
// the datetime + first 80 chars of snippet so re-syncs deduplicate.
export function gmbUpdateExternalId(u: GmbUpdate): string {
  if (u.uri) return u.uri
  const seed = `${u.datetime ?? ''}|${(u.snippet ?? '').slice(0, 80)}`
  // Cheap stable hash; collisions don't matter at this volume.
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return `gbp_${Math.abs(h)}`
}

// Tag-only — exported so other modules can introspect tasks without
// importing the response type. Keeps the API surface small.
export type _GmbTaskBag = DataForSeoTask<unknown>
