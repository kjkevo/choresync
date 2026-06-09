import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PublicProfileClient from './PublicProfileClient'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'User Profile' }
export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) notFound()

  // Fetch user's points across all households
  const { data: pointEventsRaw } = await supabase
    .from('point_events')
    .select('points')
    .eq('user_id', userId)

  const totalPoints = ((pointEventsRaw ?? []) as { points: number }[]).reduce((s, r) => s + r.points, 0)

  // Fetch user's achievements/badges count
  const { data: badgesRaw } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)

  const badgesEarned = (badgesRaw ?? []).length

  // Fetch user's chore completion count
  const { data: completionsRaw } = await supabase
    .from('chore_completions')
    .select('id')
    .eq('completed_by', userId)

  const totalChores = (completionsRaw ?? []).length

  // Fetch household name (user's primary household)
  const { data: membershipRow } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()

  let householdName: string | null = null
  if (membershipRow?.household_id) {
    const { data: household } = await supabase
      .from('households')
      .select('name')
      .eq('id', membershipRow.household_id)
      .single()
    householdName = household?.name ?? null
  }

  return (
    <PublicProfileClient
      profile={profile as UserRow}
      totalPoints={totalPoints}
      badgesEarned={badgesEarned}
      totalChores={totalChores}
      householdName={householdName}
    />
  )
}
