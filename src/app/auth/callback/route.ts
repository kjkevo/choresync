import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database'

/**
 * OAuth & magic-link callback handler.
 *
 * Supabase redirects to this route after:
 *  - Google / Apple OAuth flow
 *  - Email confirmation on sign-up
 *  - Password-reset email link
 *
 * Query params supplied by Supabase:
 *  - code          — PKCE auth code to exchange for a session
 *  - next          — optional post-auth redirect path
 *  - type          — e.g. "recovery" for password-reset
 *  - error / error_description — on failure
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code  = searchParams.get('code')
  const type  = searchParams.get('type')         // 'recovery' | 'signup' | …
  const next  = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error_description')

  // Surface Supabase-level errors (e.g. expired link, already used)
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_auth_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], _headers?: Record<string, string>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // Password-reset flow — redirect to the dedicated reset page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // All other flows (OAuth login, email confirmation) → intended destination
  return NextResponse.redirect(`${origin}${next}`)
}
