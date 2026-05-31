import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/dashboard')

  // ── 1. Profile ────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // ── 2. Primary membership + household ─────────────────────────────────────
  const { data: membershipRow } = await supabase
    .from('household_members')
    .select('role, color_theme, household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let membership: {
    role:        'admin' | 'member' | 'kids'
    color_theme: string
    household:   { id: string; name: string; invite_code: string } | null
  } | null = null

  let householdId: string | null = null
  let members: UserRow[] = []

  if (membershipRow) {
    householdId = membershipRow.household_id

    const { data: household } = await supabase
      .from('households')
      .select('id, name, invite_code')
      .eq('id', householdId)
      .maybeSingle()

    membership = {
      role:        membershipRow.role,
      color_theme: membershipRow.color_theme,
      household:   household ?? null,
    }

    // Members (for chore assignment wizard)
    const { data: memberRows } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)

    const memberIds = (memberRows ?? []).map(m => m.user_id)
    if (memberIds.length) {
      const { data: memberProfiles } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, email')
        .in('id', memberIds)
      members = (memberProfiles ?? []) as UserRow[]
    }
  }

  // ── 3. Streak ─────────────────────────────────────────────────────────────
  const { data: streakRow } = householdId
    ? await supabase
        .from('user_streaks')
        .select('current_streak, total_completions')
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .maybeSingle()
    : { data: null }

  // ── 4. Completion stats ───────────────────────────────────────────────────
  const { data: completions } = householdId
    ? await supabase
        .from('chore_completions')
        .select('was_on_time, points')
        .eq('completed_by', user.id)
        .eq('household_id', householdId)
    : { data: [] }

  const totalChores  = (completions ?? []).length
  const onTimeCount  = (completions ?? []).filter(c => c.was_on_time).length
  const onTimeRate   = totalChores > 0 ? Math.round((onTimeCount / totalChores) * 100) : 0
  const totalPoints  = (completions ?? []).reduce((s, c) => s + (c.points ?? 0), 0)

  // ── 5. Top earner? ────────────────────────────────────────────────────────
  const { data: topStreak } = householdId
    ? await supabase
        .from('user_streaks')
        .select('user_id')
        .eq('household_id', householdId)
        .order('total_completions', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const isTopEarner = topStreak?.user_id === user.id && totalChores > 0

  return (
    <ProfileClient
      user={user}
      profile={profile as UserRow}
      membership={membership}
      householdId={householdId}
      members={members}
      streak={streakRow ?? null}
      stats={{ totalChores, onTimeRate, totalPoints }}
      isTopEarner={isTopEarner}
    />
  )
}
