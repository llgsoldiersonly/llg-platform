// DataForSEO Backlinks API wrappers.
// Docs:
//   summary:       /backlinks/summary/live
//   bulk new/lost: /backlinks/bulk_new_lost_backlinks/live
//   detail rows:   /backlinks/backlinks/live  (filter by first_seen / last_seen)
//   timeseries:    /backlinks/timeseries_new_lost_summary/live
//   gap analysis:  /backlinks/domain_intersection/live

import { dataForSeoPost, getFirstResult } from './client'
import { normalizeDomain } from './normalize'

type CallOpts = { client_id?: string | null }

// ---------------------------------------------------------------
// Summary: total backlinks, ref domains, spam score, etc.
// ---------------------------------------------------------------
export async function getBacklinkSummary(inputDomain: string, opts: CallOpts = {}) {
  const target = normalizeDomain(inputDomain)
  const tag = `summary:${target}`
  const response = await dataForSeoPost<unknown>(
    '/backlinks/summary/live',
    {
      target,
      include_subdomains: true,
      include_indirect_links: true,
      exclude_internal_backlinks: true,
      rank_scale: 'one_hundred',
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  return getFirstResult(response)
}

// ---------------------------------------------------------------
// Month-to-date new/lost counts (single-target convenience wrapper).
// ---------------------------------------------------------------
export async function getCurrentMonthNewLostCounts(inputDomain: string, opts: CallOpts = {}) {
  const target = normalizeDomain(inputDomain)
  const monthStart = utcMonthStart()
  const tag = `new-lost-mtd:${target}:${monthStart}`
  const response = await dataForSeoPost<{ items?: Array<Record<string, unknown>> }>(
    '/backlinks/bulk_new_lost_backlinks/live',
    {
      targets: [target],
      date_from: monthStart,
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  const result = getFirstResult(response)
  return result?.items?.[0] ?? null
}

// ---------------------------------------------------------------
// Detailed new backlink rows for a date window.
// `monthStartDate` and `nextMonthStartDate` are 'YYYY-MM-DD' strings.
// ---------------------------------------------------------------
export async function getNewBacklinkRowsForMonth(
  inputDomain: string,
  monthStartDate: string,
  nextMonthStartDate: string,
  limit = 1000,
  opts: CallOpts = {}
) {
  const target = normalizeDomain(inputDomain)
  const tag = `new-backlinks:${target}:${monthStartDate}`
  const response = await dataForSeoPost<unknown>(
    '/backlinks/backlinks/live',
    {
      target,
      mode: 'as_is',
      filters: [
        ['first_seen', '>=', `${monthStartDate} 00:00:00 +00:00`],
        'and',
        ['first_seen', '<', `${nextMonthStartDate} 00:00:00 +00:00`],
      ],
      order_by: ['first_seen,desc', 'domain_from_rank,desc'],
      limit,
      backlinks_status_type: 'all',
      include_subdomains: true,
      include_indirect_links: true,
      exclude_internal_backlinks: true,
      rank_scale: 'one_hundred',
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  return getFirstResult(response)
}

export async function getLostBacklinkRowsForMonth(
  inputDomain: string,
  monthStartDate: string,
  nextMonthStartDate: string,
  limit = 1000,
  opts: CallOpts = {}
) {
  const target = normalizeDomain(inputDomain)
  const tag = `lost-backlinks:${target}:${monthStartDate}`
  const response = await dataForSeoPost<unknown>(
    '/backlinks/backlinks/live',
    {
      target,
      mode: 'as_is',
      backlinks_status_type: 'lost',
      filters: [
        ['last_seen', '>=', `${monthStartDate} 00:00:00 +00:00`],
        'and',
        ['last_seen', '<', `${nextMonthStartDate} 00:00:00 +00:00`],
      ],
      order_by: ['last_seen,desc', 'domain_from_rank,desc'],
      limit,
      include_subdomains: true,
      include_indirect_links: true,
      exclude_internal_backlinks: true,
      rank_scale: 'one_hundred',
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  return getFirstResult(response)
}

// ---------------------------------------------------------------
// New / lost backlinks aggregated over time (charts).
// ---------------------------------------------------------------
export async function getNewLostTimeseries(
  inputDomain: string,
  dateFrom: string,
  dateTo: string,
  groupRange: 'day' | 'week' | 'month' | 'year' = 'month',
  opts: CallOpts = {}
) {
  const target = normalizeDomain(inputDomain)
  const tag = `timeseries-new-lost:${target}:${dateFrom}:${dateTo}`
  const response = await dataForSeoPost<unknown>(
    '/backlinks/timeseries_new_lost_summary/live',
    {
      target,
      date_from: dateFrom,
      date_to: dateTo,
      group_range: groupRange,
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  return getFirstResult(response)
}

// ---------------------------------------------------------------
// Competitor backlink gap — domains linking to competitors but not us.
// ---------------------------------------------------------------
export async function getCompetitorBacklinkGap(
  clientDomain: string,
  competitorDomains: string[],
  limit = 100,
  opts: CallOpts = {}
) {
  const target1 = normalizeDomain(clientDomain)
  const targets = competitorDomains.map(normalizeDomain).filter(Boolean)
  const tag = `competitor-gap:${target1}:${targets.length}`
  const response = await dataForSeoPost<unknown>(
    '/backlinks/domain_intersection/live',
    {
      targets: [target1, ...targets],
      exclude_targets: [target1],
      limit,
      order_by: ['rank,desc'],
      rank_scale: 'one_hundred',
      tag,
    },
    { client_id: opts.client_id, request_tag: tag }
  )
  return getFirstResult(response)
}

function utcMonthStart(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}
