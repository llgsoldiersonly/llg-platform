import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isoYearWeek } from '@/lib/business-hours'

// Cron: Monday 00:00 Pacific. Rolls over unused request slots from last
// week into this week's carryover. Capped at 1× the tier's weekly cap.
//
// Vercel Cron schedule (vercel.json): "0 8 * * 1" (Mon 08:00 UTC ≈ Mon 00:00 PT
// during PST; 01:00 PT during PDT — close enough)
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const now = new Date()
  const lastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = isoYearWeek(now)
  const lastWeek = isoYearWeek(lastWeekDate)

  // Tier caps for carryover (mirrors lib/tickets/quota.ts WEEKLY_REQUEST_CAP)
  const caps: Record<string, number> = {
    GRAVITY: 1,
    LAPETUS: 2,
    RHEA: 4,
    LIVE_INTAKES: 1,
    TITAN: 9999,
  }

  const { data: clients } = await supa
    .from('clients')
    .select('id, is_demo_only')
    .neq('status', 'churned')

  const targets = (clients ?? []).filter((c) => !c.is_demo_only)

  let processed = 0
  let errors = 0

  for (const client of targets) {
    try {
      // Resolve tier (highest active subscription)
      const { data: subs } = await supa
        .from('subscriptions')
        .select('package:package_templates(code, tier_order)')
        .eq('client_id', client.id)
        .eq('status', 'active')
      type SubRow = { package: { code: string; tier_order: number } | null }
      const top = ((subs ?? []) as unknown as SubRow[]).reduce<SubRow | null>((acc, r) => {
        if (!r.package) return acc
        if (!acc?.package || r.package.tier_order > acc.package.tier_order) return r
        return acc
      }, null)
      const tier = top?.package?.code
      if (!tier) continue
      const cap = caps[tier] ?? 0
      if (cap === 0) continue

      // Get last week's usage
      const { data: lastUsage } = await supa
        .from('ticket_quota_usage')
        .select('requests_used, carried_over')
        .eq('client_id', client.id)
        .eq('year', lastWeek.year)
        .eq('iso_week', lastWeek.iso_week)
        .maybeSingle()

      const lastTotal = (lastUsage?.requests_used ?? 0)
      const lastAllowance = cap + (lastUsage?.carried_over ?? 0)
      const unused = Math.max(0, lastAllowance - lastTotal)
      // Cap carryover at 1× weekly cap (so never more than 2× total this week)
      const newCarry = Math.min(unused, cap)

      await supa
        .from('ticket_quota_usage')
        .upsert(
          {
            client_id: client.id,
            year: thisWeek.year,
            iso_week: thisWeek.iso_week,
            requests_used: 0,
            carried_over: newCarry,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id,year,iso_week' }
        )
      processed++
    } catch (e) {
      errors++
      await supa.from('sync_log').insert({
        source: 'cron:ticket-quotas',
        client_id: client.id,
        status: 'error',
        error_message: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  await supa.from('sync_log').insert({
    source: 'cron:ticket-quotas',
    status: errors > 0 ? 'partial' : 'ok',
    row_count: processed,
  })

  return NextResponse.json({ ok: true, processed, errors })
}

// Allow GET for Vercel Cron's default invocation
export const GET = POST
