import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'

export const metadata: Metadata = { title: 'Set Up Your Household' }

/**
 * Server shell: if the user already belongs to a household they've somehow
 * navigated here directly — bounce them to the dashboard.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Already in a household → skip onboarding
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) redirect('/dashboard')

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'there'

  return <OnboardingClient displayName={displayName} />
}
