import { NextResponse } from 'next/server'

// Deprecated 2026-05-11. The BrightLocal Local Rank Tracker module is not on
// the current Track-tier plan, so this cron was no-op'ing in production
// (locations with brightlocal_rank_tracker_campaign_id set: zero). Local pack
// + organic rank tracking is now handled end-to-end by cron:dataforseo-weekly
// via dfs_keyword_rank_snapshots.
//
// Route preserved as a stub so any external caller (manual probes, old cron
// schedules) gets a clear 410 instead of mysterious behavior. Safe to delete
// once vercel.json + any docs are scrubbed.
export async function POST() {
  return NextResponse.json(
    { ok: false, deprecated: true, replaced_by: 'cron:dataforseo-weekly' },
    { status: 410 }
  )
}

export const GET = POST
