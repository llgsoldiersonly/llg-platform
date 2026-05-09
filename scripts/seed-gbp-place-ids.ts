/**
 * Auto-discover GBP place_ids for every client_locations row that's missing one.
 *
 * Uses DataForSEO Local Finder ($0.002/call) — same endpoint the rankings
 * cron uses. Searches "{firm_name}" near each location's lat/lng (5km radius)
 * and takes the first result's place_id, falling back to the first result's
 * cid if place_id is missing.
 *
 * Usage:
 *   pnpm tsx scripts/seed-gbp-place-ids.ts            # dry run — prints SQL
 *   pnpm tsx scripts/seed-gbp-place-ids.ts --apply    # writes directly
 *
 * Reads DATAFORSEO_API_KEY (or LOGIN/PASSWORD) and SUPABASE_SERVICE_ROLE_KEY
 * from .env.local. Run from repo root after `source .env.local`.
 */

import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

function getAuthHeader(): string {
  const apiKey = process.env.DATAFORSEO_API_KEY?.trim()
  if (apiKey) return `Basic ${apiKey}`
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new Error('DATAFORSEO_API_KEY or DATAFORSEO_LOGIN+PASSWORD must be set')
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

async function findPlaceId(args: {
  firmName: string
  lat: number
  lng: number
}): Promise<{ place_id: string | null; cid: string | null; title: string | null; raw_first: unknown }> {
  const task = {
    keyword: args.firmName,
    location_coordinate: `${args.lat},${args.lng},5000`,
    language_code: 'en',
    device: 'desktop',
    depth: 5,
  }
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/local_finder/live/advanced', {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
  })
  const json = (await res.json()) as {
    status_code: number
    status_message: string
    tasks?: Array<{
      status_code: number
      status_message: string
      result?: Array<{
        items?: Array<Record<string, unknown>>
      }>
    }>
  }
  if (!res.ok || json.status_code !== 20000) {
    throw new Error(`DataForSEO HTTP ${res.status} status=${json.status_code} ${json.status_message}`)
  }
  const firstTask = json.tasks?.[0]
  if (!firstTask || firstTask.status_code !== 20000) {
    throw new Error(`Task error: ${firstTask?.status_message ?? 'unknown'}`)
  }
  const items = firstTask.result?.[0]?.items ?? []
  const first = items[0] as { place_id?: string; cid?: string; title?: string } | undefined
  return {
    place_id: first?.place_id ?? null,
    cid: first?.cid ?? null,
    title: first?.title ?? null,
    raw_first: first ?? null,
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set in env')
  }
  const supa = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Pull every active pilot location missing a place_id but with lat/lng set.
  const { data: locations, error } = await supa
    .from('client_locations')
    .select(`
      id, label, city, state, lat, lng, gbp_place_id,
      client:clients!inner(id, firm_name, status, is_demo_only)
    `)
    .is('gbp_place_id', null)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) throw new Error(`Supabase error: ${error.message}`)

  type Row = {
    id: string
    label: string
    city: string
    state: string
    lat: string | number
    lng: string | number
    gbp_place_id: string | null
    client: { id: string; firm_name: string; status: string; is_demo_only: boolean }
  }
  const candidates = ((locations ?? []) as unknown as Row[]).filter(
    (l) => l.client?.status === 'active' && l.client?.is_demo_only === false
  )

  console.log(`Found ${candidates.length} active-pilot location(s) missing gbp_place_id\n`)
  if (candidates.length === 0) return

  const sqlLines: string[] = []
  let okCount = 0
  let missCount = 0

  for (const loc of candidates) {
    const firm = loc.client.firm_name
    const lat = Number(loc.lat)
    const lng = Number(loc.lng)
    process.stdout.write(`  [${firm} / ${loc.label}] ... `)
    try {
      const result = await findPlaceId({ firmName: firm, lat, lng })
      if (result.place_id) {
        console.log(`✓ place_id=${result.place_id}  (matched: "${result.title}")`)
        sqlLines.push(
          `update client_locations set gbp_place_id = '${result.place_id}' where id = '${loc.id}';  -- ${firm} / ${loc.label}`
        )
        if (APPLY) {
          const { error: upErr } = await supa
            .from('client_locations')
            .update({ gbp_place_id: result.place_id })
            .eq('id', loc.id)
          if (upErr) {
            console.log(`    ⚠️  apply failed: ${upErr.message}`)
          } else {
            console.log(`    ✓ applied`)
          }
        }
        okCount++
      } else {
        console.log(`✗ no place_id in result (got cid=${result.cid ?? 'null'}, title="${result.title ?? 'null'}")`)
        missCount++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      console.log(`✗ ${msg}`)
      missCount++
    }
    // Be polite to DataForSEO — small delay between calls
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\n${okCount} resolved, ${missCount} missed`)
  if (sqlLines.length > 0) {
    console.log(APPLY ? '\nAlso applied directly via Supabase:' : '\nDRY RUN — paste these into the SQL Editor:')
    console.log('---')
    console.log(sqlLines.join('\n'))
    console.log('---')
  }
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
