import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RewardsClient from './RewardsClient'
import type { BadgeRow, UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Rewards & Badges' }
export const dynamic = 'force-dynamic'

export default async function RewardsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, color_theme').eq('user_id', user.id).maybeSingle(),
  ])

  if (!membership) redirect('/onboarding')
  const { household_id: householdId } = membership

  // ── 2. Household member map ───────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const colorMap      = Object.fromEntries((memberRows ?? []).map(m => [m.user_id, m.color_theme]))
  const memberUserIds = (memberRows ?? []).map(m => m.user_id)

  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const profileMap = Object.fromEntries((memberProfiles ?? []).map(p => [p.id, p as UserRow]))

  // ── 3. My rewards data ────────────────────────────────────────────────────
  const [
    { data: myBadges },
    { data: myStreak },
    { data: myPoints },
  ] = await Promise.all([
    supabase
      .from('badges')
      .select('*')
      .eq('user_id',      user.id)
      .eq('household_id', householdId)
      .order('earned_at', { ascending: false }),
    supabase
      .from('user_streaks')
      .select('current_streak, longest_streak, total_completions')
      .eq('user_id',      user.id)
      .eq('household_id', householdId)
      .maybeSingle(),
    supabase
      .from('point_events')
      .select('points')
      .eq('user_id',      user.id)
      .eq('household_id', householdId),
  ])

  const totalPoints = (myPoints ?? []).reduce((sum, r) => sum + r.points, 0)

  // ── 4. Household streak board ─────────────────────────────────────────────
  const { data: allStreaks } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, longest_streak, total_completions')
    .eq('household_id', householdId)
    .order('current_streak', { ascending: false })

  const householdStreaks = (allStreaks ?? []).map(s => ({
    userId:           s.user_id,
    name:             profileMap[s.user_id]?.full_name ?? null,
    avatarUrl:        profileMap[s.user_id]?.avatar_url ?? null,
    color:            colorMap[s.user_id] ?? '#6366f1',
    currentStreak:    s.current_streak,
    longestStreak:    s.longest_streak,
    totalCompletions: s.total_completions,
  }))

  // ── 5. Household-wide badges (for "who earned what") ──────────────────────
  const { data: allBadges } = await supabase
    .from('badges')
    .select('user_id, badge_type, earned_at')
    .eq('household_id', householdId)
    .order('earned_at', { ascending: false })

  return (
    <RewardsClient
      currentUser={profile as UserRow}
      myBadges={(myBadges ?? []) as BadgeRow[]}
      myStreak={myStreak ?? null}
      totalPoints={totalPoints}
      householdStreaks={householdStreaks}
      currentUserId={user.id}
      colorMap={colorMap}
      allHouseholdBadges={allBadges ?? []}
      profileMap={profileMap}
    />
  )
}
