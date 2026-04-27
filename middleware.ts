import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth/callback']

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const isAdminHost =
    host.startsWith('ops.') || host.includes('ops.llgportal.local')
  const isClientHost = !isAdminHost

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

  if (!user && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? null

    if (isAdminHost && role !== 'agency_staff' && role !== 'super_admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'forbidden')
      return NextResponse.redirect(url)
    }

    if (isClientHost && pathname === '/' && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = '/overview'
      return NextResponse.redirect(url)
    }

    if (isAdminHost && pathname === '/' && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
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
