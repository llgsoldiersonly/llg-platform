import type { SupabaseClient } from '@supabase/supabase-js'
import { isoYearWeek } from '@/lib/business-hours'

export type TierCode = 'GRAVITY' | 'LAPETUS' | 'RHEA' | 'TITAN' | 'LIVE_INTAKES'

// Per-tier weekly REQUEST cap. Bugs are unlimited at every tier.
// TITAN is unlimited but still subject to one-at-a-time per type.
const WEEKLY_REQUEST_CAP: Record<TierCode, number | 'unlimited'> = {
  GRAVITY: 1,
  LAPETUS: 2,
  RHEA: 4,
  LIVE_INTAKES: 1,
  TITAN: 'unlimited',
}

// Maximum carryover allowance: never more than 1× the weekly cap.
// So a LAPETUS who used 0 last week starts this week with 4 (2 base + 2 carryover).
function carryoverCap(tier: TierCode): number {
  const cap = WEEKLY_REQUEST_CAP[tier]
  return cap === 'unlimited' ? 9999 : cap
}

// Resolves the highest-tier active subscription for a client. Used to look
// up the right quota cap. If a client has multiple subs (Gilliam case),
// the highest-tier one wins.
export async function resolveClientTier(
  supa: SupabaseClient,
  clientId: string
): Promise<TierCode | null> {
  const { data } = await supa
    .from('subscriptions')
    .select('package:package_templates(code, tier_order)')
    .eq('client_id', clientId)
    .eq('status', 'active')

  type Row = { package: { code: TierCode; tier_order: number } | null }
  const rows = (data ?? []) as unknown as Row[]
  if (rows.length === 0) return null
  const top = rows.reduce<Row | null>((acc, r) => {
    if (!r.package) return acc
    if (!acc?.package || r.package.tier_order > acc.package.tier_order) return r
    return acc
  }, null)
  return top?.package?.code ?? null
}

export type QuotaState = {
  tier: TierCode | null
  cap: number | 'unlimited'
  used_this_week: number
  carried_over: number
  total_allowance: number  // base + carryover, capped
  remaining: number | 'unlimited'
}

export async function getQuotaState(
  supa: SupabaseClient,
  clientId: string,
  now: Date = new Date()
): Promise<QuotaState> {
  const tier = await resolveClientTier(supa, clientId)
  const { year, iso_week } = isoYearWeek(now)

  const { data: usage } = await supa
    .from('ticket_quota_usage')
    .select('requests_used, carried_over')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('iso_week', iso_week)
    .maybeSingle()

  const requests_used = usage?.requests_used ?? 0
  const carried_over = usage?.carried_over ?? 0

  if (!tier) {
    return {
      tier: null,
      cap: 0,
      used_this_week: requests_used,
      carried_over,
      total_allowance: 0,
      remaining: 0,
    }
  }

  const cap = WEEKLY_REQUEST_CAP[tier]
  if (cap === 'unlimited') {
    return {
      tier,
      cap,
      used_this_week: requests_used,
      carried_over: 0,
      total_allowance: Infinity,
      remaining: 'unlimited',
    }
  }

  const allowance = cap + carried_over
  return {
    tier,
    cap,
    used_this_week: requests_used,
    carried_over,
    total_allowance: allowance,
    remaining: Math.max(0, allowance - requests_used),
  }
}

// Increments the weekly counter for a request-type ticket. Called atomically
// after a ticket is successfully inserted. Bugs do NOT call this; they're
// unlimited.
export async function incrementRequestUsage(
  supa: SupabaseClient,
  clientId: string,
  now: Date = new Date()
): Promise<void> {
  const { year, iso_week } = isoYearWeek(now)
  const { data: existing } = await supa
    .from('ticket_quota_usage')
    .select('id, requests_used, carried_over')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('iso_week', iso_week)
    .maybeSingle()

  if (existing) {
    await supa
      .from('ticket_quota_usage')
      .update({
        requests_used: (existing.requests_used ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supa
      .from('ticket_quota_usage')
      .insert({
        client_id: clientId,
        year,
        iso_week,
        requests_used: 1,
        carried_over: 0,
      })
  }
}

export { WEEKLY_REQUEST_CAP, carryoverCap }
