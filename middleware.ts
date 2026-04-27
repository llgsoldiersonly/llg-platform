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
    const isStaff = role === 'agency_staff' || role === 'super_admin'

    // /admin/* requires staff
    if (isAdminPath && !isStaff) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'forbidden')
      return NextResponse.redirect(url)
    }

    // Admin-host requires staff (defense in depth — covers cases where someone
    // hits ops.* with a non-/admin path).
    if (isAdminHost && !isStaff) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'forbidden')
      return NextResponse.redirect(url)
    }

    // Root redirect: staff → admin dashboard, clients → overview
    if (pathname === '/' && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = isStaff ? '/admin/dashboard' : '/overview'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook|api/cron|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
