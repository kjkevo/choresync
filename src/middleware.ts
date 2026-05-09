import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

// Unauthenticated users may visit these
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]

// Authenticated users without a household may visit these in addition to PUBLIC_ROUTES
const ONBOARDING_ROUTES = ['/onboarding']

// Never redirect these (Supabase OAuth/magic-link callbacks)
const CALLBACK_ROUTES = ['/auth/callback']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, response } = createMiddlewareClient(request)

  // Always call getUser() (not getSession()) so the JWT is validated server-side.
  // This also silently rotates an expired access token and writes the refreshed
  // cookie back to the response via the middleware client's setAll hook.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic      = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  const isOnboarding  = ONBOARDING_ROUTES.some(r => pathname.startsWith(r))
  const isCallback    = CALLBACK_ROUTES.some(r => pathname.startsWith(r))

  // ── 1. Unauthenticated → send to login (preserve destination) ─────────────
  if (!user && !isPublic && !isCallback) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── 2. Authenticated user on a pure public/auth page → dashboard ──────────
  //    (Onboarding is intentionally excluded: a logged-in user without a
  //    household must be able to land there.)
  if (user && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search   = ''
    return NextResponse.redirect(url)
  }

  // ── 3. Pass through — session cookies already updated in response ──────────
  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public asset extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
