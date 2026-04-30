import { describe, it, expect } from 'vitest'
import { classify, relativeAge } from './health'

const NOW = new Date('2026-04-29T12:00:00Z')

describe('classify', () => {
  it('returns "never" when no successful sync recorded', () => {
    expect(classify(null, 24, NOW)).toBe('never')
  })

  it('returns "green" within one expected interval (daily / 24h)', () => {
    const justNow = new Date('2026-04-29T11:59:00Z') // 1 min ago
    const halfWay = new Date('2026-04-29T00:00:00Z') // 12h ago
    const justBefore = new Date('2026-04-28T12:00:01Z') // 23:59:59 ago
    expect(classify(justNow, 24, NOW)).toBe('green')
    expect(classify(halfWay, 24, NOW)).toBe('green')
    expect(classify(justBefore, 24, NOW)).toBe('green')
  })

  it('returns "yellow" between 1× and 2× expected interval', () => {
    const oneDayAgo = new Date('2026-04-28T12:00:00Z') // exactly 24h
    const dayAndHalf = new Date('2026-04-28T00:00:00Z') // 36h
    expect(classify(oneDayAgo, 24, NOW)).toBe('yellow')
    expect(classify(dayAndHalf, 24, NOW)).toBe('yellow')
  })

  it('returns "red" at or beyond 2× expected interval', () => {
    const twoDaysAgo = new Date('2026-04-27T12:00:00Z') // exactly 48h
    const week = new Date('2026-04-22T12:00:00Z') // 7d
    expect(classify(twoDaysAgo, 24, NOW)).toBe('red')
    expect(classify(week, 24, NOW)).toBe('red')
  })

  it('respects the weekly cadence (8d threshold)', () => {
    const sixDaysAgo = new Date('2026-04-23T12:00:00Z')
    const tenDaysAgo = new Date('2026-04-19T12:00:00Z')
    const twentyDaysAgo = new Date('2026-04-09T12:00:00Z')
    expect(classify(sixDaysAgo, 24 * 8, NOW)).toBe('green')
    expect(classify(tenDaysAgo, 24 * 8, NOW)).toBe('yellow')
    expect(classify(twentyDaysAgo, 24 * 8, NOW)).toBe('red')
  })

  it('respects the monthly cadence (35d threshold)', () => {
    const oneWeekAgo = new Date('2026-04-22T12:00:00Z')
    const fortyDaysAgo = new Date('2026-03-20T12:00:00Z')
    const ninetyDaysAgo = new Date('2026-01-29T12:00:00Z')
    expect(classify(oneWeekAgo, 24 * 35, NOW)).toBe('green')
    expect(classify(fortyDaysAgo, 24 * 35, NOW)).toBe('yellow')
    expect(classify(ninetyDaysAgo, 24 * 35, NOW)).toBe('red')
  })

  it('handles ISO strings as well as Date objects', () => {
    expect(classify('2026-04-29T11:00:00Z', 24, NOW)).toBe('green')
    expect(classify(new Date('2026-04-29T11:00:00Z'), 24, NOW)).toBe('green')
  })
})

describe('relativeAge', () => {
  it('returns "never" when null', () => {
    expect(relativeAge(null, NOW)).toBe('never')
  })

  it('formats sub-hour as minutes', () => {
    expect(relativeAge(new Date('2026-04-29T11:30:00Z'), NOW)).toBe('30m ago')
    expect(relativeAge(new Date('2026-04-29T11:59:30Z'), NOW)).toBe('1m ago')
  })

  it('formats sub-day as hours', () => {
    expect(relativeAge(new Date('2026-04-29T09:00:00Z'), NOW)).toBe('3h ago')
    expect(relativeAge(new Date('2026-04-28T13:00:00Z'), NOW)).toBe('23h ago')
  })

  it('formats anything older as days', () => {
    expect(relativeAge(new Date('2026-04-27T12:00:00Z'), NOW)).toBe('2d ago')
    expect(relativeAge(new Date('2026-03-29T12:00:00Z'), NOW)).toBe('31d ago')
  })
})
