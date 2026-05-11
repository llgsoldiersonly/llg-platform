import { NextResponse } from 'next/server'

// Deprecated 2026-05-11. The BrightLocal Citation Tracker module is not on
// the current Track-tier plan, so this cron was no-op'ing in production
// (locations with brightlocal_citation_report_id set: zero). When citation
// monitoring becomes a product priority again, the replacement should be a
// DataForSEO Local Business Listings audit or a BrightLocal plan upgrade —
// not a revival of this route.
//
// Route preserved as a stub so any external caller (manual probes, old cron
// schedules) gets a clear 410 instead of mysterious behavior. Safe to delete
// once vercel.json + any docs are scrubbed.
export async function POST() {
  return NextResponse.json(
    { ok: false, deprecated: true, replaced_by: null },
    { status: 410 }
  )
}

export const GET = POST
