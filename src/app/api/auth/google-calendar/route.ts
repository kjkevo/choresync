import { NextResponse } from 'next/server'
import { cookies }       from 'next/headers'
import { randomUUID }    from 'crypto'
import { createClient }  from '@/lib/supabase/server'

// Scopes: read + write calendar events on the user's primary calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

/**
 * GET /api/auth/google-calendar
 * Kick off the Google OAuth 2.0 consent flow.
 * Requires GOOGLE_CALENDAR_CLIENT_ID env var.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`)
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  if (!clientId) {
    // Env var not yet configured — bounce back with a clear error
    return NextResponse.redirect(`${siteUrl}/profile?gcal=not_configured`)
  }

  // CSRF token: stored in an HttpOnly cookie, echoed in the OAuth state param
  const state = randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('gcal_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600, // 10 minutes — plenty for an OAuth round-trip
    path:     '/',
  })

  const redirectUri = `${siteUrl}/api/auth/google-calendar/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',  // required to receive a refresh_token
    prompt:        'consent',  // force consent so Google always returns refresh_token
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  )
}
