import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

/**
 * Protected app routes — redirect to /onboarding when no valid session.
 * Public routes (login, signup, onboarding, join, privacy, terms) are
 * always accessible without a session.
 */
const PUBLIC_PREFIXES = [
  '/onboarding',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/join/',
  '/privacy',
  '/terms',
]

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  // MUST call getUser() here — this is what refreshes the Supabase session
  // cookie and ensures downstream server components see a valid (or absent) user.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow public routes through regardless of auth state
  const isPublic = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  if (isPublic) return response

  // TODO: re-enable before launch
  // if (!user) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   url.searchParams.set('redirectTo', pathname)
  //   return NextResponse.redirect(url)
  // }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
