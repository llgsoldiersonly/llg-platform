// Date helpers for crons and rollups — extracted so we can unit-test the
// year-rollover edge cases (Jan 1 cron must snapshot December of prior year).

export type MonthBounds = {
  /** First day of the snapshot month, ISO date string `YYYY-MM-DD`. */
  monthStartIso: string
  /** First day of the *next* month after the snapshot month, exclusive upper
   *  bound for filters. ISO date string. */
  monthEndExclusiveIso: string
  /** ISO datetime equivalent of monthEndExclusiveIso for `started_at`-style
   *  timestamptz filters. */
  monthEndExclusiveTsIso: string
  /** Year-start ISO date of the snapshot month — `${YYYY}-01-01`. */
  yearStartIso: string
}

/** Given the moment the cron fires (typically "now"), return the bounds of the
 *  *previous* full calendar month. UTC throughout. */
export function snapshotMonthFor(now: Date): MonthBounds {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthStartIso = start.toISOString().slice(0, 10)
  const monthEndExclusiveIso = endExclusive.toISOString().slice(0, 10)
  return {
    monthStartIso,
    monthEndExclusiveIso,
    monthEndExclusiveTsIso: endExclusive.toISOString(),
    yearStartIso: `${start.getUTCFullYear()}-01-01`,
  }
}
