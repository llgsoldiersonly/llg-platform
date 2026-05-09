// DataForSEO Google Business Profile (read-only) wrappers.
//
// Endpoint: /serp/google/local_finder/live/advanced
//
// We use Local Finder (not /business_listings/search/live) because:
//   1. It's cheaper (~$0.002/call vs ~$0.01+ for business_listings)
//   2. It's the same endpoint already used for place_id seeding and local rankings
//   3. It reliably returns rating, review count, address, phone, url, place_id
//
// Lookup: always requires lat/lng (Local Finder is coordinate-scoped).
// placeId is used for result matching when available; otherwise matches by keyword.

import { dataForSeoPost, getFirstResult, type DataForSeoTask } from './client'

// Always requires lat/lng so Local Finder can scope the search geographically.
// placeId, if provided, is used for precise result matching (not as a filter param).
type LookupArgs = {
  keyword: string
  lat: number
  lng: number
  placeId?: string
}

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

export async function getGmbInfo(args: LookupArgs, opts: Opts = {}): Promise<GmbInfoResult | null> {
  const task = {
    keyword: args.keyword,
    location_coordinate: `${args.lat},${args.lng},5000`,
    language_code: 'en',
    device: 'desktop',
    depth: 20,
  }

  const res = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/serp/google/local_finder/live/advanced',
    task,
    { client_id: opts.client_id, request_tag: 'gmb_info' }
  )
  const result = getFirstResult(res) as { items?: Array<Record<string, unknown>> } | null
  const items = result?.items ?? []

  const localItems = items.filter((i) =>
    ['local_pack', 'local_finder', 'maps_search'].includes(String(i.type ?? ''))
  )

  const nameLower = args.keyword.toLowerCase()
  const match = args.placeId
    ? (localItems.find((i) => i.place_id === args.placeId) ??
       localItems.find((i) => String(i.title ?? '').toLowerCase().includes(nameLower)))
    : localItems.find((i) => String(i.title ?? '').toLowerCase().includes(nameLower))

  if (!match) return null

  const rating = match.rating as { value?: number; votes_count?: number } | undefined
  return {
    type: String(match.type ?? 'local_finder'),
    title: match.title as string | undefined,
    rating: rating ? { value: rating.value, votes_count: rating.votes_count } : undefined,
    category: match.category as string | undefined,
    categories: match.categories as string[] | undefined,
    phone: match.phone as string | undefined,
    url: match.url as string | undefined,
    address: match.address as string | undefined,
    address_info: match.address_info as Record<string, unknown> | undefined,
    place_id: match.place_id as string | undefined,
    cid: match.cid as string | undefined,
    main_image_url: match.main_image_url as string | undefined,
    total_photos: match.total_photos as number | undefined,
    is_claimed: match.is_claimed as boolean | undefined,
  }
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
