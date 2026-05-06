import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'
import {
  getBacklinkSummary,
  getCurrentMonthNewLostCounts,
} from '@/lib/integrations/dataforseo/backlinks'

// Live (uncached) backlink summary. Staff-only — clients see the cached
// version that reads from dfs_backlink_snapshots, not this endpoint.
//
// Query: ?domain=example.com&clientId=<uuid>
//   - domain   (required) — passed straight to DataForSEO (normalized server-side)
//   - clientId (optional) — attached to dfs_usage_log row for cost attribution
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAgencyStaff(user)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const domain = req.nextUrl.searchParams.get('domain')
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!domain) {
    return NextResponse.json({ ok: false, error: 'missing domain param' }, { status: 400 })
  }

  try {
    const [summary, currentMonth] = await Promise.all([
      getBacklinkSummary(domain, { client_id: clientId }),
      getCurrentMonthNewLostCounts(domain, { client_id: clientId }),
    ])
    return NextResponse.json({ ok: true, domain, summary, current_month: currentMonth })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
