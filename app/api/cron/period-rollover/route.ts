import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPeriodRollover } from '@/lib/deliverables/rollover'

// Period rollover — runs at 00:05 UTC on the 1st of each month.
// Materializes a fresh batch of `deliverables` rows from `package_deliverables`
// for every active subscription. Idempotent and safe to re-run mid-month; the
// core logic lives in lib/deliverables/rollover so the admin "Generate
// deliverables now" button can reuse it scoped to a single client.
export async function POST(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supa = createAdminClient()
  const start = Date.now()

  let result
  try {
    result = await runPeriodRollover(supa)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }

  await supa.from('sync_log').insert({
    source: 'cron:period-rollover',
    status: result.errors.length > 0 ? (result.created > 0 ? 'partial' : 'error') : 'ok',
    row_count: result.created,
    error_message:
      result.errors.length > 0
        ? `${result.errors.length} error(s); first: ${result.errors[0].message}`
        : null,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    subscriptions_processed: result.subscriptionsProcessed,
    created: result.created,
    skipped: result.skipped,
    errors: result.errors.length,
    error_sample: result.errors.slice(0, 5),
    duration_ms: Date.now() - start,
  })
}

export const GET = POST
