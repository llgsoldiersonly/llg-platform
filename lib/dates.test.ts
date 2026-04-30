import { describe, it, expect } from 'vitest'
import { snapshotMonthFor } from './dates'

describe('snapshotMonthFor', () => {
  it('returns the previous full month when fired mid-month (sanity)', () => {
    const fired = new Date('2026-04-15T00:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(m.monthStartIso).toBe('2026-03-01')
    expect(m.monthEndExclusiveIso).toBe('2026-04-01')
    expect(m.yearStartIso).toBe('2026-01-01')
  })

  it('returns the previous month when fired on the 1st (the actual cron schedule)', () => {
    const fired = new Date('2026-05-01T00:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(m.monthStartIso).toBe('2026-04-01')
    expect(m.monthEndExclusiveIso).toBe('2026-05-01')
  })

  it('rolls over the year correctly when fired Jan 1 (snapshots December of prior year)', () => {
    const fired = new Date('2027-01-01T00:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(m.monthStartIso).toBe('2026-12-01')
    expect(m.monthEndExclusiveIso).toBe('2027-01-01')
    expect(m.yearStartIso).toBe('2026-01-01')
  })

  it('handles February in a leap year (Mar 1 fires → snapshots Feb)', () => {
    const fired = new Date('2028-03-01T00:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(m.monthStartIso).toBe('2028-02-01')
    expect(m.monthEndExclusiveIso).toBe('2028-03-01')
  })

  it('uses UTC consistently regardless of timezone of the input Date', () => {
    // A Date that's "May 1 in some negative-offset zone" is still April 30 UTC
    const fired = new Date('2026-05-01T03:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(m.monthStartIso).toBe('2026-04-01')
    expect(m.monthEndExclusiveIso).toBe('2026-05-01')
  })

  it('monthEndExclusiveTsIso is parseable as a full timestamp', () => {
    const fired = new Date('2026-05-01T00:00:00Z')
    const m = snapshotMonthFor(fired)
    expect(new Date(m.monthEndExclusiveTsIso).toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })
})
