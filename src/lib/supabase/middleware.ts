import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/types/database'

/**
 * Creates a Supabase client tied to the middleware request/response cycle.
 * This is the only place where we can both READ and WRITE cookies in the
 * middleware context.  Returns both the client and the (potentially mutated)
 * NextResponse so the caller can forward updated Set-Cookie headers.
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Forward cookies to the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Forward cookies to the response (for the browser)
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response }
}
