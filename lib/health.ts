// Sync-health threshold logic — extracted so we can unit-test boundary cases
// without rendering the dashboard page.
//
// Classifies how stale a per-client integration is, given the timestamp of
// its last successful sync and how often the cron is expected to run.
//
//   green  : less than 1 expected interval has passed
//   yellow : between 1 and 2 intervals
//   red    : 2+ intervals
//   never  : no successful sync recorded

export type Health = 'green' | 'yellow' | 'red' | 'never'

export function classify(
  lastOkAt: string | Date | null,
  expectedHours: number,
  now: Date = new Date()
): Health {
  if (lastOkAt == null) return 'never'
  const last = typeof lastOkAt === 'string' ? new Date(lastOkAt) : lastOkAt
  const elapsedHours = (now.getTime() - last.getTime()) / 3_600_000
  if (elapsedHours < expectedHours) return 'green'
  if (elapsedHours < expectedHours * 2) return 'yellow'
  return 'red'
}

// Human-readable elapsed time for sync-health cells. Capped at days for
// anything older than 24h; minutes for recent.
export function relativeAge(iso: string | Date | null, now: Date = new Date()): string {
  if (iso == null) return 'never'
  const ts = typeof iso === 'string' ? new Date(iso) : iso
  const elapsedMin = (now.getTime() - ts.getTime()) / 60_000
  if (elapsedMin < 60) return `${Math.round(elapsedMin)}m ago`
  if (elapsedMin < 60 * 24) return `${Math.round(elapsedMin / 60)}h ago`
  return `${Math.round(elapsedMin / (60 * 24))}d ago`
}
