import { type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

// Auth gates are disabled during active app development.
// All routes are open — the app always opens directly to /dashboard.
export async function middleware(request: NextRequest) {
  const { response } = createMiddlewareClient(request)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
