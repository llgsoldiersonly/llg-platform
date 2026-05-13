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

import { dataForSeoPost, dataForSeoGet } from './client'
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

// GBP Posts ("Updates") — DataForSEO exposes these via the task-based
// /business_data/google/my_business_updates endpoint. No `/live` variant
// exists. We submit a task, poll for ~30s, then collect — single-pass,
// runs inline in the weekly cron's GBP batch.
export type GmbUpdate = {
  type: string
  snippet?: string
  image_url?: string
  datetime?: string
  uri?: string
}

type TaskGetResult = {
  items?: Array<Record<string, unknown>>
  items_count?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getGmbUpdates(args: LookupArgs, opts: Opts = {}): Promise<GmbUpdate[]> {
  const tag = `gbp-updates:${args.placeId || args.firmName.slice(0, 40)}`

  // Build the task. place_id (when present) is the cleanest matcher;
  // otherwise fall back to keyword + United States location.
  const task: Record<string, unknown> = {
    location_name: 'United States',
    language_name: 'English',
    tag,
  }
  if (args.placeId) {
    task.place_id = args.placeId
  } else {
    task.keyword = args.firmName
  }

  // 1) Submit task
  const postRes = await dataForSeoPost<{ tasks?: Array<{ id?: string; status_code?: number }> }>(
    '/business_data/google/my_business_updates/task_post',
    task,
    { client_id: opts.client_id, request_tag: tag }
  )
  const taskId = postRes.tasks?.[0]?.id
  if (!taskId) return []

  // 2) Poll task_get until ready or we hit ~30s total wait. DFS GBP tasks
  //    typically complete in 10-20s.
  const maxAttempts = 4
  const waitPerAttempt = 8000 // 8s × 4 = 32s max
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(waitPerAttempt)

    let getRes
    try {
      getRes = await dataForSeoGet<TaskGetResult>(
        `/business_data/google/my_business_updates/task_get/${encodeURIComponent(taskId)}`,
        { client_id: opts.client_id, request_tag: tag }
      )
    } catch {
      // Network / 5xx — try again
      continue
    }

    const firstTask = getRes.tasks?.[0]
    const statusCode = firstTask?.status_code ?? 0
    if (statusCode === 20100) continue // 20100 = still processing
    if (statusCode >= 40000) return [] // permanent failure (e.g. no GBP found)

    const result = firstTask?.result?.[0]
    const items = (result?.items ?? []) as Array<Record<string, unknown>>
    return items.map(parseUpdate)
  }
  // Gave up waiting — caller treats this as no posts. Same-day cron retry
  // can pick it up next run.
  return []
}

function parseUpdate(raw: Record<string, unknown>): GmbUpdate {
  const postText = typeof raw.post_text === 'string' ? raw.post_text : undefined
  const snippet = typeof raw.snippet === 'string' ? raw.snippet : undefined
  const imageUrl = typeof raw.images_url === 'string' ? raw.images_url : undefined
  const url = typeof raw.url === 'string' ? raw.url : undefined
  // DFS returns timestamp in mm/dd/yyyy hh:mm:ss; also exposes `timestamp` in UTC.
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : undefined
  return {
    type: 'google_business_post',
    snippet: postText || snippet,
    image_url: imageUrl,
    datetime: timestamp,
    uri: url,
  }
}

export function gmbUpdateExternalId(u: GmbUpdate): string {
  if (u.uri) return u.uri
  const seed = `${u.datetime ?? ''}|${(u.snippet ?? '').slice(0, 80)}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return `gbp_${Math.abs(h)}`
}
