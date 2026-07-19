import { NextRequest, NextResponse } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/signout']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  return NextResponse.redirect(loginUrl)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Authentication must never prevent the login or recovery routes from loading.
  // This is especially important for installed PWAs that can retain stale cookies.
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
  }

  const response = NextResponse.next({ request })
  const supabase = createProxyClient(request, response)

  try {
    // getClaims verifies the JWT and usually avoids the user-profile network request
    // made by getUser. The custom client also caps external auth calls at 5 seconds.
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims?.sub) {
      return redirectToLogin(request)
    }
  } catch (error) {
    console.error(
      'Authentication check failed in proxy:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return redirectToLogin(request)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Keep PWA and other static assets out of the authentication proxy. Installed
     * shortcuts request manifest.json and sw.js during startup, and neither needs
     * a user session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|json|js|css|txt|xml|map|woff2?|ttf)$).*)',
  ],
}
