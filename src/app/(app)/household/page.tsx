import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import HouseholdClient from './HouseholdClient'
import type { HouseholdMember, UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Household Settings' }

// Force dynamic so the page always reflects latest membership data
export const dynamic = 'force-dynamic'

export default async function HouseholdPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ── 1. Caller's own membership ────────────────────────────────────────────
  const { data: myMembership } = await supabase
    .from('household_members')
    .select('id, household_id, role, color_theme')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMembership) redirect('/onboarding')

  const householdId = myMembership.household_id

  // ── 2. Household details ──────────────────────────────────────────────────
  const { data: household } = await supabase
    .from('households')
    .select('id, name, invite_code, created_at')
    .eq('id', householdId)
    .single()

  if (!household) notFound()

  // ── 3. All members + their user profiles ─────────────────────────────────
  const { data: memberships } = await supabase
    .from('household_members')
    .select('id, user_id, household_id, role, color_theme, joined_at')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })

  const memberIds = (memberships ?? []).map(m => m.user_id)

  const { data: profiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email, created_at, updated_at')
    .in('id', memberIds)

  // Zip memberships + profiles together into enriched members
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const members: (HouseholdMember & { user: UserRow })[] = (memberships ?? []).map(m => ({
    ...m,
    user: profileMap[m.user_id] ?? {
      id:         m.user_id,
      email:      '',
      full_name:  null,
      avatar_url: null,
      created_at: '',
      updated_at: '',
    },
  }))

  return (
    <HouseholdClient
      household={household}
      members={members}
      currentUserId={user.id}
      currentUserRole={myMembership.role as 'admin' | 'member'}
      currentUserMembershipId={myMembership.id}
    />
  )
}
