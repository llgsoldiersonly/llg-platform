import type { SupabaseClient } from '@supabase/supabase-js'

export type RolloverResult = {
  subscriptionsProcessed: number
  created: number
  skipped: number
  errors: Array<{ subscription_id: string; message: string }>
}

// Materializes `deliverables` rows from `package_deliverables` for the current
// period, for every active subscription (optionally scoped to one client).
//
// Idempotent: a row already present for (subscription, template, period_start)
// — or (subscription, template) for `once` — is skipped. Safe to re-run any
// time, which is what lets a new mid-month client get deliverables immediately
// instead of waiting for the 1st-of-month cron.
//
// Frequency handling (v1):
//   monthly / weekly / ongoing → 1 row per calendar month
//   quarterly                  → 1 row per calendar quarter
//   once                       → 1 row per subscription lifetime
export async function runPeriodRollover(
  supa: SupabaseClient,
  opts: { clientId?: string } = {}
): Promise<RolloverResult> {
  const today = new Date()
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()

  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const monthStart = ymd(new Date(Date.UTC(y, m, 1)))
  const monthEnd = ymd(new Date(Date.UTC(y, m + 1, 0)))
  const qStartMonth = Math.floor(m / 3) * 3
  const quarterStart = ymd(new Date(Date.UTC(y, qStartMonth, 1)))
  const quarterEnd = ymd(new Date(Date.UTC(y, qStartMonth + 3, 0)))

  let query = supa
    .from('subscriptions')
    .select('id, package_id, started_at, ended_at')
    .eq('status', 'active')
  if (opts.clientId) query = query.eq('client_id', opts.clientId)

  const { data: subs, error: subsErr } = await query
  if (subsErr) throw new Error(subsErr.message)

  let created = 0
  let skipped = 0
  const errors: Array<{ subscription_id: string; message: string }> = []

  for (const sub of subs ?? []) {
    const { data: items, error: itemsErr } = await supa
      .from('package_deliverables')
      .select('id, frequency')
      .eq('package_id', sub.package_id)

    if (itemsErr) {
      errors.push({ subscription_id: sub.id, message: `package_deliverables: ${itemsErr.message}` })
      continue
    }

    for (const pd of items ?? []) {
      let pStart: string
      let pEnd: string
      if (pd.frequency === 'monthly' || pd.frequency === 'weekly' || pd.frequency === 'ongoing') {
        pStart = monthStart
        pEnd = monthEnd
      } else if (pd.frequency === 'quarterly') {
        pStart = quarterStart
        pEnd = quarterEnd
      } else if (pd.frequency === 'once') {
        pStart = sub.started_at
        pEnd = sub.ended_at ?? '2100-12-31'
      } else {
        continue
      }

      const baseQ = supa
        .from('deliverables')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('template_id', pd.id)
        .limit(1)
      const lookup = pd.frequency === 'once' ? baseQ : baseQ.eq('period_start', pStart)
      const { data: existing } = await lookup
      if ((existing?.length ?? 0) > 0) {
        skipped += 1
        continue
      }

      const { error: insErr } = await supa.from('deliverables').insert({
        subscription_id: sub.id,
        template_id: pd.id,
        source: 'package',
        period_start: pStart,
        period_end: pEnd,
        status: 'pending',
      })
      if (insErr) {
        errors.push({ subscription_id: sub.id, message: `insert ${pd.id}: ${insErr.message}` })
      } else {
        created += 1
      }
    }
  }

  return { subscriptionsProcessed: subs?.length ?? 0, created, skipped, errors }
}
