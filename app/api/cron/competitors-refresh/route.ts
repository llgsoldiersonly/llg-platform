import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { discoverCompetitorsFromSnapshots } from '@/lib/seo/competitor-discovery'

export const maxDuration = 120

// Monthly competitor refresh — runs 1st @ 00:30 UTC.
// Derives 3-5 local competitors per active firm from the previous 30 days
// of SERP data already in dfs_keyword_rank_snapshots (we already paid for
// those calls during the weekly refresh, so this is $0 in new DFS spend).
//
// Strategy:
//   - For each active client with primary_domain set
//   - Aggregate `top_competitors` jsonb across this-month's rank snapshots
//   - Exclude client's own domain + directory aggregators + social platforms
//   - Take the 5 most-frequent remaining domains
//   - Upsert into dfs_competitor_sites (one row per domain per client)
//
// Idempotency: existing rows for the same (client_id, competitor_domain)
// pair get their is_active flag refreshed; rows no longer in the top-5 are
// marked is_active=false (preserves history without polluting the
// "currently tracking" list).
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  const monthKey = new Date().toISOString().slice(0, 7)
  const errors: Array<{ client: string; message: string }> = []
  const stats = { clients_processed: 0, competitors_upserted: 0, deactivated: 0 }

  const { data: clients, error: clientsErr } = await supa
    .from('clients')
    .select('id, firm_name, primary_domain')
    .eq('status', 'active')
    .eq('is_demo_only', false)
    .not('primary_domain', 'is', null)

  if (clientsErr) {
    return NextResponse.json({ ok: false, error: clientsErr.message }, { status: 500 })
  }

  for (const client of clients ?? []) {
    try {
      stats.clients_processed += 1

      const { data: snapshots } = await supa
        .from('dfs_keyword_rank_snapshots')
        .select('top_competitors')
        .eq('client_id', client.id)
        .eq('month_key', monthKey)

      const discovered = discoverCompetitorsFromSnapshots(
        snapshots ?? [],
        client.primary_domain,
        5
      )

      if (discovered.length === 0) {
        // No SERP data this month — skip. Will pick up after the weekly
        // refresh has had at least one run for this client.
        continue
      }

      // Upsert each discovered competitor as active. Preserve any custom
      // notes / GBP info set by staff via the admin form.
      for (const c of discovered) {
        const { data: existing } = await supa
          .from('dfs_competitor_sites')
          .select('id, competitor_name, notes')
          .eq('client_id', client.id)
          .eq('competitor_domain', c.domain)
          .maybeSingle()

        if (existing) {
          const { error } = await supa
            .from('dfs_competitor_sites')
            .update({ is_active: true })
            .eq('id', existing.id)
          if (error) throw error
        } else {
          // Use the domain as the display name until a human edits it. Cleaner
          // than "Acme Legal" inferred from the URL — staff can rename via
          // admin form.
          const { error } = await supa.from('dfs_competitor_sites').insert({
            client_id: client.id,
            competitor_name: c.domain,
            competitor_domain: c.domain,
            is_active: true,
            notes: `Auto-discovered from SERP analysis on ${new Date().toISOString().slice(0, 10)}.`,
          })
          if (error) throw error
        }
        stats.competitors_upserted += 1
      }

      // Deactivate any existing competitors NOT in the new top-5.
      const keepDomains = new Set(discovered.map((c) => c.domain))
      const { data: stale } = await supa
        .from('dfs_competitor_sites')
        .select('id, competitor_domain')
        .eq('client_id', client.id)
        .eq('is_active', true)

      for (const s of stale ?? []) {
        if (!s.competitor_domain) continue
        if (!keepDomains.has(s.competitor_domain)) {
          await supa.from('dfs_competitor_sites').update({ is_active: false }).eq('id', s.id)
          stats.deactivated += 1
        }
      }
    } catch (e) {
      errors.push({
        client: client.firm_name,
        message: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    stats,
    errors: errors.slice(0, 20),
    error_count: errors.length,
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
