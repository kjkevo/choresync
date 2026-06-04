import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RewardsClient from './RewardsClient'
import type { BadgeRow, UserRow, RewardsCatalogRow, RedemptionRow, HouseholdSettings } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Rewards & Badges' }
export const dynamic = 'force-dynamic'

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { tab: tabParam } = await searchParams
  const validTabs = ['my-badges', 'achievements', 'shop', 'leaderboard'] as const
  type TabKey = typeof validTabs[number]
  const initialTab: TabKey = (validTabs as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabKey)
    : 'my-badges'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/onboarding')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profileRaw }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, color_theme, role').eq('user_id', user.id).maybeSingle(),
  ])
  const profile = profileRaw as UserRow | null

  if (!membership) redirect('/onboarding')
  const { household_id: householdId } = membership
  const isAdmin = membership.role === 'admin'

  // ── 2. Household member map ───────────────────────────────────────────────
  const { data: memberRowsRaw } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberRows = (memberRowsRaw ?? []) as { user_id: string; color_theme: string }[]
  const memberUserIds = memberRows.map(m => m.user_id)
  const colorMap = Object.fromEntries(memberRows.map(m => [m.user_id, m.color_theme]))

  const { data: memberProfilesRaw } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const memberProfiles = (memberProfilesRaw ?? []) as UserRow[]
  const profileMap: Record<string, UserRow> = Object.fromEntries(memberProfiles.map(p => [p.id, p]))

  // ── 3. My rewards data ────────────────────────────────────────────────────
  const [
    { data: myBadgesRaw },
    { data: myStreak },
    { data: myPointsRaw },
  ] = await Promise.all([
    supabase.from('badges').select('*')
      .eq('user_id', user.id).eq('household_id', householdId)
      .order('earned_at', { ascending: false }),
    supabase.from('user_streaks')
      .select('current_streak, longest_streak, total_completions')
      .eq('user_id', user.id).eq('household_id', householdId).maybeSingle(),
    supabase.from('point_events').select('points')
      .eq('user_id', user.id).eq('household_id', householdId),
  ])

  const myBadges = (myBadgesRaw ?? []) as BadgeRow[]
  const totalPoints = ((myPointsRaw ?? []) as { points: number }[]).reduce((sum, r) => sum + r.points, 0)

  // ── 4. Household streak board ─────────────────────────────────────────────
  const { data: allStreaksRaw } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, longest_streak, total_completions')
    .eq('household_id', householdId)
    .order('current_streak', { ascending: false })

  const allStreaks = (allStreaksRaw ?? []) as { user_id: string; current_streak: number; longest_streak: number; total_completions: number }[]

  const householdStreaks = allStreaks.map(s => ({
    userId:           s.user_id,
    name:             profileMap[s.user_id]?.full_name ?? null,
    avatarUrl:        profileMap[s.user_id]?.avatar_url ?? null,
    color:            colorMap[s.user_id] ?? '#6366f1',
    currentStreak:    s.current_streak,
    longestStreak:    s.longest_streak,
    totalCompletions: s.total_completions,
  }))

  // ── 5. Household-wide badges ──────────────────────────────────────────────
  const { data: allBadgesRaw } = await supabase
    .from('badges')
    .select('user_id, badge_type, earned_at')
    .eq('household_id', householdId)
    .order('earned_at', { ascending: false })

  const allBadges = (allBadgesRaw ?? []) as BadgeRow[]

  // ── 6. Rewards catalog ────────────────────────────────────────────────────
  const { data: rewardsCatalogRaw } = await supabase
    .from('rewards_catalog')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const rewardsCatalog = (rewardsCatalogRaw ?? []) as RewardsCatalogRow[]

  // ── 7. Redemptions ────────────────────────────────────────────────────────
  const { data: redemptionsRaw } = await supabase
    .from('redemptions')
    .select('*')
    .eq('household_id', householdId)
    .order('redeemed_at', { ascending: false })
    .limit(50)

  const redemptions = (redemptionsRaw ?? []) as RedemptionRow[]

  // ── 8. Weekly points leaderboard (Monday–Sunday) ──────────────────────────
  const now = new Date()
  // Find the most recent Monday
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, …
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)
  const weekStart = monday.toISOString()

  const { data: weeklyPointRowsRaw } = await supabase
    .from('point_events')
    .select('user_id, points')
    .eq('household_id', householdId)
    .gte('earned_at', weekStart)
    .gt('points', 0)  // only positive (no spending)

  const weeklyPointRows = (weeklyPointRowsRaw ?? []) as { user_id: string; points: number }[]

  // Sum per user this week
  const weeklyTotals = new Map<string, number>()
  for (const r of weeklyPointRows) {
    weeklyTotals.set(r.user_id, (weeklyTotals.get(r.user_id) ?? 0) + r.points)
  }

  // ── 9. All-time points per user ───────────────────────────────────────────
  const { data: allTimePointRowsRaw } = await supabase
    .from('point_events')
    .select('user_id, points')
    .eq('household_id', householdId)

  const allTimePointRows = (allTimePointRowsRaw ?? []) as { user_id: string; points: number }[]

  const allTimeTotals = new Map<string, number>()
  for (const r of allTimePointRows) {
    allTimeTotals.set(r.user_id, (allTimeTotals.get(r.user_id) ?? 0) + r.points)
  }

  // Build leaderboard entries for all members
  const leaderboard = memberUserIds.map(uid => ({
    userId:         uid,
    name:           profileMap[uid]?.full_name ?? null,
    avatarUrl:      profileMap[uid]?.avatar_url ?? null,
    color:          colorMap[uid] ?? '#6366f1',
    pointsThisWeek: weeklyTotals.get(uid) ?? 0,
    pointsAllTime:  allTimeTotals.get(uid) ?? 0,
  })).sort((a, b) => b.pointsThisWeek - a.pointsThisWeek)

  // ── 10. Household settings ────────────────────────────────────────────────
  const { data: householdRaw } = await supabase
    .from('households')
    .select('id, settings')
    .eq('id', householdId)
    .maybeSingle()

  const householdSettings = (householdRaw?.settings ?? {}) as HouseholdSettings
  const leaderboardHidden = householdSettings.leaderboardHidden ?? false

  return (
    <RewardsClient
      currentUser={profile as UserRow}
      myBadges={myBadges}
      myStreak={myStreak ?? null}
      totalPoints={totalPoints}
      householdStreaks={householdStreaks}
      currentUserId={user.id}
      colorMap={colorMap}
      allHouseholdBadges={allBadges}
      profileMap={profileMap}
      rewardsCatalog={rewardsCatalog}
      redemptions={redemptions}
      leaderboard={leaderboard}
      leaderboardHidden={leaderboardHidden}
      isAdmin={isAdmin}
      householdId={householdId}
      initialTab={initialTab}
    />
  )
}
