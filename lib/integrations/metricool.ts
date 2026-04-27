// Metricool API client. Pulls per-channel social stats.
// One global API key + per-client user_id + blog_id.

export type MetricoolStatPoint = {
  channel: string                     // 'facebook', 'instagram', 'twitter', etc.
  followers?: number | null
  reach?: number | null
  impressions?: number | null
  posts_count?: number | null
  ad_spend_cents?: number | null
  raw?: unknown
}

export type MetricoolFetchOpts = {
  apiKey: string
  userId: string
  blogId: string
  startDate: Date
  endDate: Date
}

const BASE_URL = 'https://app.metricool.com/api'

function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${da}`
}

/**
 * Pull aggregate stats for a date range. Metricool's web stats endpoint
 * returns per-channel breakdowns; we normalize to MetricoolStatPoint[].
 *
 * NOTE: Metricool's API is loosely documented; the response shape can
 * vary by plan. We handle the common envelope; missing fields fall back
 * to null and the cron logs a warning.
 */
export async function fetchMetricoolStats(opts: MetricoolFetchOpts): Promise<MetricoolStatPoint[]> {
  const params = new URLSearchParams({
    userId: opts.userId,
    blogId: opts.blogId,
    start: yyyymmdd(opts.startDate),
    end: yyyymmdd(opts.endDate),
  })

  const url = `${BASE_URL}/stats/web?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'X-Mc-Auth': opts.apiKey,
      'User-Agent': 'LLG-Platform/1.0',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Metricool fetch failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const json = (await res.json()) as Record<string, unknown>

  // Common shape: { channels: [{ network: 'facebook', stats: {...} }, ...] }
  // Fallback: try to flatten what we can.
  const channels = (json.channels ?? json.networks ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(channels)) {
    return []
  }

  return channels.map((c) => {
    const stats = (c.stats ?? c) as Record<string, unknown>
    return {
      channel: String(c.network ?? c.channel ?? c.platform ?? 'unknown'),
      followers: numberOrNull(stats.followers),
      reach: numberOrNull(stats.reach),
      impressions: numberOrNull(stats.impressions),
      posts_count: numberOrNull(stats.posts ?? stats.posts_count),
      ad_spend_cents:
        stats.ad_spend !== undefined
          ? Math.round(Number(stats.ad_spend) * 100)
          : null,
      raw: c,
    }
  })
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
