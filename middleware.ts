import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth/callback']

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const isAdminHost = host.startsWith('ops.') || host.includes('ops.llgportal.local')

  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const isAdminPath = pathname.startsWith('/admin')

  // Unauthenticated → /login (with where-they-were-going)
  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? null
    const isAdmin = role === 'super_admin'
    const isStaff = role === 'agency_staff' || isAdmin

    // /admin/* is super_admin only. agency_staff lives in the client portal
    // with role-gated edit affordances; they shouldn't see admin tooling.
    if (isAdminPath && !isAdmin) {
      const url = req.nextUrl.clone()
      if (isStaff) {
        // agency_staff trying to navigate to /admin — bounce them home to the
        // client portal instead of throwing a forbidden error.
        url.pathname = '/overview'
        url.search = ''
      } else {
        url.pathname = '/login'
        url.searchParams.set('error', 'forbidden')
      }
      return NextResponse.redirect(url)
    }

    // Admin-host requires super_admin (defense in depth — covers cases
    // where someone hits ops.* with a non-/admin path).
    if (isAdminHost && !isAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = isStaff ? '/overview' : '/login'
      if (!isStaff) url.searchParams.set('error', 'forbidden')
      else url.search = ''
      return NextResponse.redirect(url)
    }

    // Root redirect: super_admin → admin dashboard, everyone else → overview
    // (agency_staff lives in client portal; client_users go to their overview)
    if (pathname === '/' && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = isAdmin ? '/admin/dashboard' : '/overview'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook|api/cron|api/health|api/dataforseo|multichannel-marketing|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
