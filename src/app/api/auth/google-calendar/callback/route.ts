import { NextResponse } from 'next/server'
import { cookies }       from 'next/headers'
import { createClient }  from '@/lib/supabase/server'

/**
 * GET /api/auth/google-calendar/callback
 * Google redirects here after the user grants (or denies) consent.
 *
 * Query params from Google:
 *   code  – authorization code to exchange for tokens
 *   state – echoes the CSRF value we set in the initiation route
 *   error – present when the user denied access
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const siteUrl    = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const profileUrl = `${siteUrl}/profile`

  // ── 1. User denied consent ────────────────────────────────────────────────
  if (error) {
    return NextResponse.redirect(`${profileUrl}?gcal=denied`)
  }

  // ── 2. CSRF check ─────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gcal_oauth_state')?.value
  cookieStore.delete('gcal_oauth_state')

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${profileUrl}?gcal=error`)
  }

  if (!code) {
    return NextResponse.redirect(`${profileUrl}?gcal=error`)
  }

  // ── 3. Verify the user is still logged in ─────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`)
  }

  // ── 4. Exchange the authorization code for tokens ─────────────────────────
  const redirectUri = `${siteUrl}/api/auth/google-calendar/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(`${profileUrl}?gcal=error`)
  }

  const tokens: { refresh_token?: string; access_token?: string } = await tokenRes.json()

  // refresh_token is only returned on the first authorization OR when
  // prompt=consent forces a fresh grant. It should always be present here
  // because we set prompt=consent in the initiation route.
  if (!tokens.refresh_token) {
    console.error('Google did not return a refresh_token. Make sure prompt=consent is set.')
    return NextResponse.redirect(`${profileUrl}?gcal=error`)
  }

  // ── 5. Persist the refresh token ──────────────────────────────────────────
  // Use the user's own session — RLS policy `users_update_own` allows this.
  const { error: dbError } = await supabase
    .from('users')
    .update({ google_calendar_refresh_token: tokens.refresh_token })
    .eq('id', user.id)

  if (dbError) {
    console.error('Failed to store Google Calendar token:', dbError.message)
    return NextResponse.redirect(`${profileUrl}?gcal=error`)
  }

  return NextResponse.redirect(`${profileUrl}?gcal=connected`)
}
