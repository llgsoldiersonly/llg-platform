// DataForSEO REST API client. Single source of truth for outbound calls.
//
// Auth (preferred): DATAFORSEO_API_KEY — the base64 token shown on the
// DataForSEO API Access page. Sent verbatim as `Authorization: Basic <key>`.
// Auth (fallback):  DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD — encoded at runtime.
// All endpoints in this codebase post a single task object wrapped in an array,
// per DataForSEO's "live" endpoint shape:
//   POST /v3/<path>   body: [{ ...task }]
//
// Responses are validated at three levels:
//   1. HTTP status
//   2. Top-level json.status_code (20000 = ok)
//   3. The first task's status_code
//
// Cost is logged to dfs_usage_log (best-effort — never throws on log failure).

import { createAdminClient } from '@/lib/supabase/admin'

const BASE_URL =
  process.env.DATAFORSEO_BASE_URL ?? 'https://api.dataforseo.com/v3'

export type DataForSeoTask<T> = {
  id: string
  status_code: number
  status_message: string
  time: string
  cost: number
  result_count: number
  path: string[]
  data: Record<string, unknown>
  result: T[] | null
}

export type DataForSeoResponse<T> = {
  version: string
  status_code: number
  status_message: string
  time: string
  cost: number
  tasks_count: number
  tasks_error: number
  tasks: DataForSeoTask<T>[]
}

export class DataForSeoError extends Error {
  status_code?: number
  status_message?: string
  details?: unknown
  constructor(message: string, opts?: { status_code?: number; status_message?: string; details?: unknown }) {
    super(message)
    this.name = 'DataForSeoError'
    this.status_code = opts?.status_code
    this.status_message = opts?.status_message
    this.details = opts?.details
  }
}

function getAuthHeader(): string {
  // Preferred: DATAFORSEO_API_KEY is the ready-to-use base64 token from
  // DataForSEO's API Access page (it's already base64(login:password)).
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim()
  if (apiKey) return `Basic ${apiKey}`

  // Fallback: legacy split form. Encode login:password at runtime.
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new DataForSeoError(
      'DataForSEO credentials not configured. Set DATAFORSEO_API_KEY (preferred) or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.'
    )
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

type PostOptions = {
  // Optional client_id to attach to the usage log row.
  client_id?: string | null
  // Optional human label that gets stored in dfs_usage_log.request_tag.
  request_tag?: string
}

export async function dataForSeoPost<T>(
  path: string,
  task: Record<string, unknown>,
  opts: PostOptions = {}
): Promise<DataForSeoResponse<T>> {
  const url = `${BASE_URL}${path}`
  const startedAt = Date.now()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        'User-Agent': 'LLG-Platform/1.0',
      },
      body: JSON.stringify([task]),
      cache: 'no-store',
    })
  } catch (err) {
    throw new DataForSeoError('DataForSEO network error', { details: err })
  }

  let json: DataForSeoResponse<T>
  try {
    json = (await res.json()) as DataForSeoResponse<T>
  } catch (err) {
    throw new DataForSeoError(`DataForSEO non-JSON response (HTTP ${res.status})`, {
      status_code: res.status,
      details: err,
    })
  }

  // Best-effort usage log — never block on failure.
  void logUsage({
    endpoint: path,
    cost: json?.cost ?? 0,
    tasks_count: json?.tasks_count ?? 0,
    tasks_error: json?.tasks_error ?? 0,
    raw_status_code: json?.status_code ?? res.status,
    raw_status_message: json?.status_message ?? null,
    request_tag: opts.request_tag ?? (task.tag as string | undefined) ?? null,
    client_id: opts.client_id ?? null,
    duration_ms: Date.now() - startedAt,
  })

  if (!res.ok) {
    throw new DataForSeoError(`DataForSEO HTTP ${res.status}`, {
      status_code: res.status,
      status_message: json?.status_message,
      details: json,
    })
  }

  if (json.status_code !== 20000) {
    throw new DataForSeoError(`DataForSEO API error: ${json.status_message}`, {
      status_code: json.status_code,
      status_message: json.status_message,
      details: json,
    })
  }

  const firstTask = json.tasks?.[0]
  if (firstTask && firstTask.status_code !== 20000) {
    throw new DataForSeoError(`DataForSEO task error: ${firstTask.status_message}`, {
      status_code: firstTask.status_code,
      status_message: firstTask.status_message,
      details: firstTask,
    })
  }

  return json
}

export function getFirstResult<T>(response: DataForSeoResponse<T>): T | null {
  return response.tasks?.[0]?.result?.[0] ?? null
}

// GET wrapper for endpoints that take a path-encoded id (tasks_ready,
// task_get/{id}) rather than a posted task body.
export async function dataForSeoGet<T>(
  path: string,
  opts: PostOptions = {}
): Promise<DataForSeoResponse<T>> {
  const url = `${BASE_URL}${path}`
  const startedAt = Date.now()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(),
        'User-Agent': 'LLG-Platform/1.0',
      },
      cache: 'no-store',
    })
  } catch (err) {
    throw new DataForSeoError('DataForSEO network error', { details: err })
  }

  let json: DataForSeoResponse<T>
  try {
    json = (await res.json()) as DataForSeoResponse<T>
  } catch (err) {
    throw new DataForSeoError(`DataForSEO non-JSON response (HTTP ${res.status})`, {
      status_code: res.status,
      details: err,
    })
  }

  void logUsage({
    endpoint: path,
    cost: json?.cost ?? 0,
    tasks_count: json?.tasks_count ?? 0,
    tasks_error: json?.tasks_error ?? 0,
    raw_status_code: json?.status_code ?? res.status,
    raw_status_message: json?.status_message ?? null,
    request_tag: opts.request_tag ?? null,
    client_id: opts.client_id ?? null,
    duration_ms: Date.now() - startedAt,
  })

  if (!res.ok) {
    throw new DataForSeoError(`DataForSEO HTTP ${res.status}`, {
      status_code: res.status,
      status_message: json?.status_message,
      details: json,
    })
  }

  if (json.status_code !== 20000) {
    throw new DataForSeoError(`DataForSEO API error: ${json.status_message}`, {
      status_code: json.status_code,
      status_message: json.status_message,
      details: json,
    })
  }

  return json
}

type UsageRow = {
  endpoint: string
  cost: number
  tasks_count: number
  tasks_error: number
  raw_status_code: number | null
  raw_status_message: string | null
  request_tag: string | null
  client_id: string | null
  duration_ms: number
}

async function logUsage(row: UsageRow): Promise<void> {
  try {
    const supa = createAdminClient()
    await supa.from('dfs_usage_log').insert({
      client_id: row.client_id,
      endpoint: row.endpoint,
      cost: row.cost,
      tasks_count: row.tasks_count,
      tasks_error: row.tasks_error,
      request_tag: row.request_tag,
      raw_status_code: row.raw_status_code,
      raw_status_message: row.raw_status_message,
      duration_ms: row.duration_ms,
    })
  } catch {
    // Swallow. Usage logging is observational, never load-bearing.
  }
}
