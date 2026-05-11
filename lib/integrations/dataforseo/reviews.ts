// DataForSEO Google Reviews — task-based flow.
//
// /reviews has no /live variant. Three calls per cycle:
//   1. POST /business_data/google/reviews/task_post  — submit task, get task_id
//   2. GET  /business_data/google/reviews/tasks_ready — list completed tasks
//   3. GET  /business_data/google/reviews/task_get/advanced/{id}
//
// We encode our client + location in the task `tag` so tasks_ready -> task_get
// can route results back without a separate tracking table. Tag format:
//   reviews:<client_uuid>:<location_uuid>

import { dataForSeoPost, dataForSeoGet, DataForSeoError } from './client'

type Opts = { client_id?: string | null }

export type ReviewsLookupIdentifier =
  | { placeId: string }
  | { cid: string }
  | { keyword: string }

export type ReviewsTaskSubmitArgs = ReviewsLookupIdentifier & {
  clientId: string
  locationId: string | null
  locationName?: string         // 'Texas,United States' — full DFS location string
  locationCoordinate?: string   // 'lat,lng,radius' (min radius 199.9)
  languageName?: string         // default 'English'
  depth?: number                // reviews to pull, default 10
  sortBy?: 'newest' | 'highest_rating' | 'lowest_rating' | 'relevant'
}

export type ReviewItem = {
  position: number | null
  type: string
  review_id?: string | null
  reviewer?: {
    name?: string | null
    url?: string | null
    image_url?: string | null
    reviews_count?: number | null
    photos_count?: number | null
  }
  rating?: { value?: number | null; max?: number | null }
  text?: string | null
  timestamp?: string | null          // ISO-8601
  owner_answer?: { text?: string | null; timestamp?: string | null } | null
  url?: string | null
  raw: unknown
}

export type ReviewsTaskResult = {
  task_id: string
  tag: string | null
  place_id?: string | null
  cid?: string | null
  items: ReviewItem[]
}

function buildTag(clientId: string, locationId: string | null): string {
  return `reviews:${clientId}:${locationId ?? '-'}`
}

export function parseReviewsTag(
  tag: string | null | undefined
): { clientId: string; locationId: string | null } | null {
  if (!tag) return null
  const parts = tag.split(':')
  if (parts.length !== 3 || parts[0] !== 'reviews') return null
  const clientId = parts[1]
  const locationId = parts[2] === '-' ? null : parts[2]
  if (!clientId) return null
  return { clientId, locationId }
}

// Submits a Google Reviews task. Returns the DFS task id.
export async function submitReviewsTask(
  args: ReviewsTaskSubmitArgs,
  opts: Opts = {}
): Promise<string> {
  const task: Record<string, unknown> = {
    tag: buildTag(args.clientId, args.locationId),
    depth: args.depth ?? 10,
    sort_by: args.sortBy ?? 'newest',
    language_name: args.languageName ?? 'English',
  }

  if ('placeId' in args) task.place_id = args.placeId
  else if ('cid' in args) task.cid = args.cid
  else task.keyword = args.keyword

  if (args.locationCoordinate) {
    task.location_coordinate = args.locationCoordinate
  } else if (args.locationName) {
    task.location_name = args.locationName
  } else {
    // Default that satisfies DFS's location requirement; tag identifies the
    // real location for downstream routing.
    task.location_name = 'United States'
  }

  const res = await dataForSeoPost<unknown>(
    '/business_data/google/reviews/task_post',
    task,
    { client_id: opts.client_id, request_tag: task.tag as string }
  )
  const taskId = res.tasks?.[0]?.id
  if (!taskId) {
    throw new DataForSeoError('reviews task_post returned no task id', {
      status_code: res.tasks?.[0]?.status_code,
      status_message: res.tasks?.[0]?.status_message,
      details: res,
    })
  }
  return taskId
}

type TasksReadyEntry = {
  id: string
  se: string
  se_type: string
  date_posted: string
  tag: string | null
  endpoint: string
}

// Lists completed-but-uncollected reviews tasks. Note: this returns tasks
// across the entire DataForSEO account, not just ours — filter by tag prefix
// 'reviews:' to keep collection scoped.
export async function listReadyReviewsTasks(): Promise<TasksReadyEntry[]> {
  const res = await dataForSeoGet<{ tasks?: TasksReadyEntry[] }>(
    '/business_data/google/reviews/tasks_ready'
  )
  const result = res.tasks?.[0]?.result?.[0]
  return result?.tasks ?? []
}

type TaskGetResult = {
  place_id?: string | null
  cid?: string | null
  items?: Array<Record<string, unknown>>
  items_count?: number
}

export async function getReviewsTaskResults(
  taskId: string,
  opts: Opts & { tag?: string | null } = {}
): Promise<ReviewsTaskResult> {
  const res = await dataForSeoGet<TaskGetResult>(
    `/business_data/google/reviews/task_get/${encodeURIComponent(taskId)}`,
    { client_id: opts.client_id, request_tag: opts.tag ?? undefined }
  )
  const firstTask = res.tasks?.[0]
  const result = firstTask?.result?.[0]
  const tag = firstTask?.data?.tag as string | null | undefined ?? opts.tag ?? null

  const items: ReviewItem[] = (result?.items ?? []).map((it) => {
    const r = it as Record<string, unknown>
    const reviewer = (r.profile_image_url || r.profile_name)
      ? {
          name: (r.profile_name as string | null) ?? null,
          url: (r.profile_url as string | null) ?? null,
          image_url: (r.profile_image_url as string | null) ?? null,
          reviews_count: (r.reviews_count as number | null) ?? null,
          photos_count: (r.photos_count as number | null) ?? null,
        }
      : undefined
    const ratingValue = (r.rating as { value?: number } | undefined)?.value
    return {
      position: (r.position as number | null) ?? null,
      type: (r.type as string) ?? 'review',
      review_id: (r.review_id as string | null) ?? null,
      reviewer,
      rating: ratingValue != null ? { value: ratingValue, max: 5 } : undefined,
      text: (r.review_text as string | null) ?? null,
      timestamp: (r.timestamp as string | null) ?? null,
      owner_answer:
        r.owner_answer && typeof r.owner_answer === 'object'
          ? {
              text: ((r.owner_answer as Record<string, unknown>).text as string) ?? null,
              timestamp: ((r.owner_answer as Record<string, unknown>).timestamp as string) ?? null,
            }
          : null,
      url: (r.review_url as string | null) ?? null,
      raw: r,
    }
  })

  return {
    task_id: taskId,
    tag: tag ?? null,
    place_id: result?.place_id ?? null,
    cid: result?.cid ?? null,
    items,
  }
}
