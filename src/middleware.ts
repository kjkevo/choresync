import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

/**
 * Protected app routes — redirect to /onboarding when no valid session.
 * Public routes (login, signup, onboarding, join, privacy, terms) are
 * always accessible without a session.
 * Settings routes also allowed (e.g. /settings/change-password)
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
  '/settings/change-password',
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

  // Unauthenticated requests to app routes → /login with redirectTo param
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated users without a household → onboarding to create/join one
  // Exception: allow settings routes (e.g., change password) even without household
  if (pathname.startsWith('/settings')) return response
  if (pathname.startsWith('/profile') || pathname === '/dashboard' || pathname === '/' || pathname.startsWith('/calendar') || pathname.startsWith('/social') || pathname.startsWith('/history')) {
    // Check if user has a household membership
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // No household → redirect to onboarding
    if (!membership?.household_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
