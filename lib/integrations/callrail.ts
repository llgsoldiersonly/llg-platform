// CallRail API client. Pulls calls via global API token + per-client
// account_id (and optional company_id).

export type CallRailCall = {
  id: string
  duration: number
  source: string | null
  source_name: string | null
  tracker: string | null
  recording: string | null
  customer_name: string | null
  customer_phone_number: string | null
  first_call: boolean
  agent_email: string | null
  start_time: string
  // CallRail returns tags only when `fields=tags` is on the request. Each
  // tag is a string like "qualified" / "conversion" / "abandoned". Calls
  // can have zero or many; downstream code (lib/calls/status.ts) derives a
  // single status from this array.
  tags?: string[] | null
  raw?: unknown
}

export type CallRailFetchOpts = {
  apiToken: string
  accountId: string
  companyId?: string                       // Optional filter
  startDate: Date                          // YYYY-MM-DD
  endDate: Date
  perPage?: number
}

const BASE_URL = 'https://api.callrail.com/v3'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Fetch all calls in a date range. Auto-paginates.
 */
export async function fetchCallRailCalls(opts: CallRailFetchOpts): Promise<CallRailCall[]> {
  const perPage = opts.perPage ?? 250
  const allCalls: CallRailCall[] = []

  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      start_date: ymd(opts.startDate),
      end_date: ymd(opts.endDate),
      // Default response omits tags. Explicitly request them.
      fields: 'tags',
    })
    if (opts.companyId) params.set('company_id', opts.companyId)

    const url = `${BASE_URL}/a/${opts.accountId}/calls.json?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Token token="${opts.apiToken}"`,
        'User-Agent': 'LLG-Platform/1.0',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`CallRail fetch failed (${res.status}): ${body.slice(0, 300)}`)
    }
    // CallRail returns `tags` as an array of objects { id, name, tag_level, … },
    // not strings. Flatten to just the names so downstream code (and our text[]
    // column) sees ['Conversion', 'Existing Customer'] instead of stringified
    // JSON blobs. Lowercasing happens at status-derivation time, not here.
    type RawTag = string | { name?: string | null }
    type RawCall = Omit<CallRailCall, 'tags'> & { tags?: RawTag[] | null }
    const json = (await res.json()) as { calls: RawCall[]; total_pages?: number; page?: number }
    const calls: CallRailCall[] = (json.calls ?? []).map((c) => ({
      ...c,
      tags: Array.isArray(c.tags)
        ? c.tags
            .map((t) => (typeof t === 'string' ? t : t?.name ?? ''))
            .filter((s): s is string => Boolean(s))
        : null,
    }))
    allCalls.push(...calls)
    if (calls.length < perPage) break
    if (json.total_pages && page >= json.total_pages) break
  }

  return allCalls
}
