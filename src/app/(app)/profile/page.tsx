import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export const metadata: Metadata = { title: 'Profile' }

/**
 * Server Component shell — fetches the current user + their public profile,
 * then hands everything off to the interactive Client Component.
 */
export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: membershipRow } = await supabase
    .from('household_members')
    .select('role, color_theme, household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let membership: { role: 'admin' | 'member' | 'kids'; color_theme: string; household: { id: string; name: string } | null } | null = null

  if (membershipRow) {
    const { data: household } = await supabase
      .from('households')
      .select('id, name')
      .eq('id', membershipRow.household_id)
      .maybeSingle()

    membership = {
      role:        membershipRow.role,
      color_theme: membershipRow.color_theme,
      household:   household ?? null,
    }
  }

  return (
    <ProfileClient
      user={user}
      profile={profile}
      membership={membership}
    />
  )
}
