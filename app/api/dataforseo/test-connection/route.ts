import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAgencyStaff } from '@/lib/auth/rbac'

// Verifies DataForSEO credentials are configured and reachable.
// Hits GET /appendix/user_data — returns auth + account state without
// requiring any specific API subscription, so a fresh DataForSEO account
// (no Backlinks/SERP plan yet) still passes the smoke test.
//
// Auth: agency staff session OR x-cron-secret header (so curl-from-terminal
// works during initial setup before login is wired into a UI).
export async function GET(req: Request) {
  const headerSecret = req.headers.get('x-cron-secret')
  const cronOk = !!process.env.CRON_SECRET && headerSecret === process.env.CRON_SECRET

  let staffOk = false
  if (!cronOk) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    staffOk = isAgencyStaff(user)
  }

  if (!cronOk && !staffOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.DATAFORSEO_API_KEY?.trim()
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  const baseUrl = process.env.DATAFORSEO_BASE_URL ?? 'https://api.dataforseo.com/v3'

  let authHeader: string
  if (apiKey) {
    authHeader = `Basic ${apiKey}`
  } else if (login && password) {
    authHeader = `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
  } else {
    return NextResponse.json(
      {
        ok: false,
        error:
          'DataForSEO credentials not configured. Set DATAFORSEO_API_KEY (preferred) or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.',
      },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(`${baseUrl}/appendix/user_data`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'User-Agent': 'LLG-Platform/1.0',
      },
      cache: 'no-store',
    })

    const json = await res.json()
    if (!res.ok || json.status_code !== 20000) {
      return NextResponse.json(
        {
          ok: false,
          error: json.status_message ?? `HTTP ${res.status}`,
          status_code: json.status_code,
        },
        { status: res.ok ? 502 : res.status }
      )
    }

    const account = json.tasks?.[0]?.result?.[0] ?? {}
    return NextResponse.json({
      ok: true,
      login: account.login ?? null,
      timezone: account.timezone ?? null,
      money: account.money ?? null, // { balance, total, spent, ... }
      // Daily limits — all-zero means no subscription is active yet.
      // Surface only the headline product groups so the response stays small.
      limits: {
        backlinks_day: account.rates?.limits?.day?.backlinks?.total ?? 0,
        serp_day: account.rates?.limits?.day?.serp?.total ?? 0,
        ai_optimization_day: account.rates?.limits?.day?.ai_optimization?.total ?? 0,
        dataforseo_labs_day: account.rates?.limits?.day?.dataforseo_labs?.total ?? 0,
      },
      raw: account.rates?.limits?.day ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
