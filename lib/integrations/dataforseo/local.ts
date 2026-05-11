// DataForSEO Local Finder + Google Maps wrappers.
//
// Two distinct endpoints:
//  /serp/google/local_finder/live/advanced  — Local Pack/Finder, location_name based
//  /serp/google/maps/live/advanced          — Google Maps, location_coordinate based
//
// Local Finder gives you "the local pack a typical Dallas user sees."
// Maps gives you "the map listings someone standing at lat/lng,zoom would see."
// The map-grid sweep iterates Maps across many lat/lng points around an office.

import { dataForSeoPost, getFirstResult } from './client'

type CallOpts = { client_id?: string | null }

type LocalFinderInput = {
  keyword: string
  // Match by GBP listing title (preferred — exact-match) OR by domain (fallback).
  businessName?: string
  clientDomain?: string
  // Local Finder accepts location_name or location_code only (NOT
  // location_coordinate — verified 2026-05-11: passing coordinates returns
  // "No Search Results"). For lat/lng-based lookup, use the Maps endpoint
  // (getGoogleMapsRankAtPoint) instead.
  locationCode?: number
  locationName?: string
  languageCode?: string
  device?: 'desktop' | 'mobile'
}

export type LocalRankResult = {
  raw: unknown
  client_rank_group: number | null
  client_rank_absolute: number | null
  client_found: boolean
  top_results: Array<{
    rank_group: number | null
    rank_absolute: number | null
    title: string | null
    rating: number | null
    reviews_count: number | null
    address: string | null
    phone: string | null
    url: string | null
    cid: string | null
    place_id: string | null
  }>
}

export async function getGoogleLocalFinderRank(
  input: LocalFinderInput,
  opts: CallOpts = {}
): Promise<LocalRankResult> {
  const task: Record<string, unknown> = {
    keyword: input.keyword,
    language_code: input.languageCode ?? 'en',
    device: input.device ?? 'desktop',
    depth: 100,
    tag: `local-finder:${input.businessName ?? input.clientDomain ?? '?'}:${input.keyword}`,
  }
  if (input.locationCode) task.location_code = input.locationCode
  else if (input.locationName) task.location_name = input.locationName

  const response = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/serp/google/local_finder/live/advanced',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )

  const result = getFirstResult(response)
  return matchLocalResult(result, input.businessName, input.clientDomain)
}

// ---------------------------------------------------------------
// Single-point Google Maps rank (one node of a map grid sweep).
// ---------------------------------------------------------------
type MapsPointInput = {
  keyword: string
  lat: number
  lng: number
  zoom?: number // Google Maps zoom level (1=world, 21=street). Defaults to 12.
  businessName?: string
  clientDomain?: string
  /** Preferred matcher — exact place_id match avoids name/domain false positives. */
  clientPlaceId?: string
  languageCode?: string
  device?: 'desktop' | 'mobile'
}

export async function getGoogleMapsRankAtPoint(
  input: MapsPointInput,
  opts: CallOpts = {}
): Promise<LocalRankResult> {
  // location_coordinate format: "lat,lng,zoom"
  const zoom = input.zoom ?? 12
  const task: Record<string, unknown> = {
    keyword: input.keyword,
    language_code: input.languageCode ?? 'en',
    device: input.device ?? 'desktop',
    depth: 100,
    location_coordinate: `${input.lat},${input.lng},${zoom}`,
    tag: `maps-grid:${input.lat},${input.lng}:${input.keyword}`,
  }

  const response = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/serp/google/maps/live/advanced',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )

  const result = getFirstResult(response)
  return matchLocalResult(result, input.businessName, input.clientDomain, input.clientPlaceId)
}

// ---------------------------------------------------------------
// Shared shape for Local Finder + Maps. Match priority (highest to lowest):
//   1. place_id — globally unique, no false positives
//   2. domain   — pretty unique
//   3. name     — last-resort substring match (can match unrelated businesses)
// ---------------------------------------------------------------
function matchLocalResult(
  result: unknown,
  businessName?: string,
  clientDomain?: string,
  clientPlaceId?: string
): LocalRankResult {
  const items = ((result as { items?: Array<Record<string, unknown>> })?.items ?? []) as Array<
    Record<string, unknown>
  >
  // Both endpoints return mixed items; the listings we care about are typed
  // 'local_pack', 'local_finder', or 'maps_search'.
  const localItems = items.filter((i) =>
    ['local_pack', 'local_finder', 'maps_search'].includes(String(i.type ?? ''))
  )

  const nameLower = businessName?.toLowerCase() ?? ''
  const domainLower = clientDomain?.toLowerCase().replace(/^www\./, '') ?? ''
  const placeIdExact = clientPlaceId ?? ''

  // Priority 1: place_id (exact, globally unique — no false positives)
  const placeIdMatch = placeIdExact
    ? localItems.find((i) => String(i.place_id ?? '') === placeIdExact)
    : null
  // Priority 2: domain
  const domainMatch = !placeIdMatch && domainLower
    ? localItems.find((i) => {
        const url = String(i.url ?? '').toLowerCase()
        const domain = String(i.domain ?? '').toLowerCase()
        return url.includes(domainLower) || domain.includes(domainLower)
      })
    : null
  // Priority 3: name (substring — can collide; only used when nothing else hits)
  const nameMatch = !placeIdMatch && !domainMatch && nameLower
    ? localItems.find((i) =>
        String(i.title ?? '').toLowerCase().includes(nameLower)
      )
    : null
  const match = placeIdMatch ?? domainMatch ?? nameMatch

  return {
    raw: result,
    client_rank_group: (match?.rank_group as number | undefined) ?? null,
    client_rank_absolute: (match?.rank_absolute as number | undefined) ?? null,
    client_found: !!match,
    top_results: localItems.slice(0, 10).map((i) => ({
      rank_group: (i.rank_group as number | undefined) ?? null,
      rank_absolute: (i.rank_absolute as number | undefined) ?? null,
      title: (i.title as string | undefined) ?? null,
      rating: ((i.rating as { value?: number } | undefined)?.value as number | undefined) ?? null,
      reviews_count: ((i.rating as { votes_count?: number } | undefined)?.votes_count as
        | number
        | undefined) ?? null,
      address: (i.address as string | undefined) ?? null,
      phone: (i.phone as string | undefined) ?? null,
      url: (i.url as string | undefined) ?? null,
      cid: (i.cid as string | undefined) ?? null,
      place_id: (i.place_id as string | undefined) ?? null,
    })),
  }
}
