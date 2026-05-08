import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Period rollover — runs at 00:05 UTC on the 1st of each month.
// For every active subscription, materializes a fresh batch of `deliverables`
// rows from `package_deliverables` covering the new period. Idempotent: if a
// row already exists for (subscription_id, template_id, period_start), it is
// skipped. Safe to re-run mid-month (e.g. when a new client signs up).
//
// Frequency handling (v1):
//   monthly / weekly / ongoing → 1 row per calendar month
//   quarterly                  → 1 row per calendar quarter
//   once                       → 1 row per subscription lifetime
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const start = Date.now()
  const today = new Date()
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()

  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const monthStart = ymd(new Date(Date.UTC(y, m, 1)))
  const monthEnd = ymd(new Date(Date.UTC(y, m + 1, 0)))
  const qStartMonth = Math.floor(m / 3) * 3
  const quarterStart = ymd(new Date(Date.UTC(y, qStartMonth, 1)))
  const quarterEnd = ymd(new Date(Date.UTC(y, qStartMonth + 3, 0)))

  const { data: subs, error: subsErr } = await supa
    .from('subscriptions')
    .select('id, package_id, started_at, ended_at')
    .eq('status', 'active')

  if (subsErr) {
    return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 })
  }

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

      // Idempotency: 'once' rows match on (sub, template) regardless of period;
      // recurring rows match on (sub, template, period_start).
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

  await supa.from('sync_log').insert({
    source: 'cron:period-rollover',
    status: errors.length > 0 ? (created > 0 ? 'partial' : 'error') : 'ok',
    row_count: created,
    error_message: errors.length > 0 ? `${errors.length} error(s); first: ${errors[0].message}` : null,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    subscriptions_processed: subs?.length ?? 0,
    created,
    skipped,
    errors: errors.length,
    error_sample: errors.slice(0, 5),
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
