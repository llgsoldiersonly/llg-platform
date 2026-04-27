// Business-hours math for SLA deadlines.
// "Add N business hours to start" = walk forward, only counting time that
// falls within the configured business window on a configured business day.

export type BusinessHoursConfig = {
  business_hours_start: string  // "08:00"
  business_hours_end: string    // "17:00"
  business_timezone: string     // IANA TZ
  business_days: number[]       // 1..7 (Mon..Sun)
}

function parseHm(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number)
  return { h, m: m ?? 0 }
}

// Returns the date adjusted by `days`, ignoring time portion.
function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isoWeekday(d: Date): number {
  // JS getUTCDay: 0..6 (Sun..Sat). ISO: 1..7 (Mon..Sun).
  const js = d.getUTCDay()
  return js === 0 ? 7 : js
}

// Returns the number of MILLISECONDS the given Date is past the start of
// the business day in the configured timezone. Negative if before, > end-start
// if after close.
function msIntoBusinessDay(d: Date, cfg: BusinessHoursConfig): number {
  // Convert to a "wall-clock" representation in the business timezone.
  // We approximate with Intl.DateTimeFormat to avoid pulling in date-fns-tz.
  const localStr = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.business_timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)

  const get = (t: string) => Number(localStr.find((p) => p.type === t)?.value ?? '0')
  const localH = get('hour')
  const localM = get('minute')
  const localS = get('second')

  const start = parseHm(cfg.business_hours_start)
  const startMs = (start.h * 60 + start.m) * 60_000

  const localMs = (localH * 3600 + localM * 60 + localS) * 1000
  return localMs - startMs
}

function businessDayLengthMs(cfg: BusinessHoursConfig): number {
  const start = parseHm(cfg.business_hours_start)
  const end = parseHm(cfg.business_hours_end)
  return ((end.h * 60 + end.m) - (start.h * 60 + start.m)) * 60_000
}

// Round a Date to the start of the business day in the business timezone,
// then return as a UTC Date pointing at that wall-clock instant.
// Uses a simple offset trick rather than full TZ math.
function startOfBusinessDay(d: Date, cfg: BusinessHoursConfig): Date {
  // Format the input in the business TZ to get the local Y-M-D, then
  // construct an ISO string at business_hours_start in that TZ. Convert
  // back to UTC by subtracting the TZ offset for that local time.
  const localStr = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.business_timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => localStr.find((p) => p.type === t)?.value ?? ''
  const y = get('year')
  const mo = get('month')
  const da = get('day')
  const start = parseHm(cfg.business_hours_start)
  // Anchor at noon UTC then adjust to the local TZ offset for that day to
  // avoid DST landmines.
  const localIso = `${y}-${mo}-${da}T${String(start.h).padStart(2, '0')}:${String(start.m).padStart(2, '0')}:00`
  const offsetMs = tzOffsetMs(localIso, cfg.business_timezone)
  return new Date(new Date(localIso + 'Z').getTime() - offsetMs)
}

function tzOffsetMs(localIsoZ: string, tz: string): number {
  // Given an ISO string interpreted as local time, compute how many ms
  // we should subtract from its UTC parse to get the actual UTC instant.
  const utcMs = new Date(localIsoZ + 'Z').getTime()
  const localFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs))
  const part = (t: string) => Number(localFormatted.find((p) => p.type === t)?.value ?? 0)
  // Reconstruct what the same UTC instant looks like in the target TZ:
  const reconstructed = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  )
  return reconstructed - utcMs
}

// Move forward to the start of the NEXT business day (skips weekends + non-business days).
function nextBusinessDayStart(d: Date, cfg: BusinessHoursConfig): Date {
  let candidate = addDays(d, 1)
  // Reset to start-of-day in business TZ
  candidate = startOfBusinessDay(candidate, cfg)
  while (!cfg.business_days.includes(isoWeekday(candidate))) {
    candidate = addDays(candidate, 1)
    candidate = startOfBusinessDay(candidate, cfg)
  }
  return candidate
}

/**
 * Add N business hours to a start Date. Returns the resulting Date in UTC.
 *
 * Rules:
 *  - If start is outside business hours / on a non-business day, clock starts
 *    at the next business day's open time.
 *  - Hours past close roll to the next business day.
 *  - Skips weekends and non-business days entirely.
 */
export function addBusinessHours(start: Date, hours: number, cfg: BusinessHoursConfig): Date {
  const dayLengthMs = businessDayLengthMs(cfg)
  let remainingMs = hours * 3_600_000

  let cursor = new Date(start)

  // If we're not in a business window, jump to the next one.
  while (remainingMs > 0) {
    const isBusinessDay = cfg.business_days.includes(isoWeekday(cursor))
    const intoDay = msIntoBusinessDay(cursor, cfg)

    if (!isBusinessDay || intoDay >= dayLengthMs) {
      // Past end of business day or weekend → roll forward
      cursor = nextBusinessDayStart(cursor, cfg)
      continue
    }

    if (intoDay < 0) {
      // Before business hours start today → snap to start
      cursor = startOfBusinessDay(cursor, cfg)
      continue
    }

    const remainingInDay = dayLengthMs - intoDay
    if (remainingMs <= remainingInDay) {
      cursor = new Date(cursor.getTime() + remainingMs)
      remainingMs = 0
    } else {
      remainingMs -= remainingInDay
      cursor = nextBusinessDayStart(cursor, cfg)
    }
  }

  return cursor
}

// Convenience: compute SLA deadline given a tier code + priority.
export function slaDeadlineFor(
  start: Date,
  tier: string,
  priority: 'urgent' | 'high' | 'medium' | 'low',
  settings: {
    business_hours_start: string
    business_hours_end: string
    business_timezone: string
    business_days: number[]
    sla_gravity_urgent_hours: number
    sla_gravity_normal_hours: number
    sla_lapetus_urgent_hours: number
    sla_lapetus_normal_hours: number
    sla_rhea_urgent_hours: number
    sla_rhea_normal_hours: number
    sla_titan_urgent_hours: number
    sla_titan_normal_hours: number
  }
): Date {
  const isUrgent = priority === 'urgent' || priority === 'high'
  const tierKey = (tier || 'lapetus').toLowerCase()
  const slaMap = settings as unknown as Record<string, number>
  const hours =
    isUrgent
      ? slaMap[`sla_${tierKey}_urgent_hours`] ?? settings.sla_lapetus_urgent_hours
      : slaMap[`sla_${tierKey}_normal_hours`] ?? settings.sla_lapetus_normal_hours

  return addBusinessHours(start, hours, settings)
}

// ISO week of a date (1..53). Used to bucket ticket_quota_usage rows.
export function isoYearWeek(d: Date): { year: number; iso_week: number } {
  // Algorithm from the ISO 8601 spec.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604_800_000)
  // ISO year may differ from calendar year at year boundaries
  const iso_year =
    week === 1 && d.getUTCMonth() === 11
      ? d.getUTCFullYear() + 1
      : week >= 52 && d.getUTCMonth() === 0
        ? d.getUTCFullYear() - 1
        : d.getUTCFullYear()
  return { year: iso_year, iso_week: week }
}
