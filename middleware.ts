import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth/callback']

// Routes that belong strictly to the client portal (clients only — staff
// and super_admin shouldn't accidentally land here). Listed explicitly
// rather than relying on a path prefix because the client portal lives
// at the root, which would otherwise match everything.
const CLIENT_ONLY_PATHS = [
  '/overview',
  '/plan',
  '/seo',
  '/tickets',
  '/profile',
  '/team',
]

type CookieToSet = { name: string; value: string; options: CookieOptions }

function isClientOnlyPath(pathname: string): boolean {
  return CLIENT_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

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
  const isStaffPath = pathname.startsWith('/staff')
  const isClientPath = isClientOnlyPath(pathname)

  // Unauthenticated → /login (with where-they-were-going)
  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? null
    const isSuperAdmin = role === 'super_admin'
    const isAgencyStaff = role === 'agency_staff'
    const isClient = role === 'client_user'

    // Each role gets one portal. Visiting the wrong portal redirects to
    // your own home.
    function homeForRole(): string {
      if (isSuperAdmin) return '/admin/dashboard'
      if (isAgencyStaff) return '/staff'
      return '/overview' // client_user (or no-role fallback)
    }

    // /admin/* is super_admin only.
    if (isAdminPath && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = homeForRole()
      url.search = ''
      return NextResponse.redirect(url)
    }

    // /staff/* is agency_staff only. super_admin is intentionally NOT
    // allowed here — keeps the three portals strictly separate. If admin
    // needs to inspect the staff view, they should sign in as a staff
    // account.
    if (isStaffPath && !isAgencyStaff) {
      const url = req.nextUrl.clone()
      url.pathname = homeForRole()
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Client paths (/overview, /seo, /tickets, /plan, /profile, /team) are
    // for client_user, with super_admin also allowed for inspection /
    // debugging. agency_staff is hard-blocked — they live exclusively at
    // /staff. When super_admin lands on /overview, the existing
    // impersonation feature (lib/impersonation.ts) determines which
    // client's data they're viewing; without a cookie set, RLS picks one
    // arbitrarily.
    if (isClientPath && !isClient && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = homeForRole()
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Admin-host (ops.*) requires super_admin (defense in depth — covers
    // cases where someone hits ops.* with a non-/admin path).
    if (isAdminHost && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = homeForRole()
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Root redirect: send each role to their own portal.
    if (pathname === '/' && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = homeForRole()
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
