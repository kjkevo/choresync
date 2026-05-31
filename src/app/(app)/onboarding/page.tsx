import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'

export const metadata: Metadata = { title: 'Set Up Your Household' }

/**
 * Always shows the Join / Create choice screen.
 * Any logged-in user can visit this page — including existing members who
 * want to create a second household or join another one.
 * Unauthenticated visitors get a guest display name.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'there'

  return <OnboardingClient displayName={displayName} />
}
