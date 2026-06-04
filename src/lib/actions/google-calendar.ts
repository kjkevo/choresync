'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/lib/supabase/server'

/**
 * Revoke the stored Google Calendar refresh token and optionally
 * notify Google's revocation endpoint so the grant is removed
 * from the user's Google account permissions.
 */
export async function disconnectGoogleCalendar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch the token before clearing it so we can revoke it at Google
  const { data: profile } = await supabase
    .from('users')
    .select('google_calendar_refresh_token')
    .eq('id', user.id)
    .maybeSingle()

  const token = profile?.google_calendar_refresh_token

  // Clear from DB
  const { error: dbError } = await supabase
    .from('users')
    .update({ google_calendar_refresh_token: null })
    .eq('id', user.id)

  if (dbError) return { error: dbError.message }

  // Best-effort revoke at Google — don't fail the UI if this errors
  if (token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => {/* ignore network errors */})
  }

  revalidatePath('/profile')
  return { success: true }
}
