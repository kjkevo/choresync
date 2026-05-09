import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { ChoreWithAssignee, UserRow, LeaderboardEntry, AnnouncementWithAuthor } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, role, color_theme').eq('user_id', user.id).maybeSingle(),
  ])

  if (!membership) redirect('/onboarding')

  const { household_id: householdId } = membership

  // ── 2. All members (for color map + leaderboard) ──────────────────────────
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const colorMap = Object.fromEntries((memberRows ?? []).map(m => [m.user_id, m.color_theme]))

  const memberUserIds = (memberRows ?? []).map(m => m.user_id)
  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const profileMap = Object.fromEntries((memberProfiles ?? []).map(p => [p.id, p as UserRow]))

  // ── 3. My chores: today + overdue (assigned to me, incomplete) ────────────
  const today = new Date().toISOString().split('T')[0]

  const { data: myChoreRows } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .eq('assigned_to', user.id)
    .eq('status', 'incomplete')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .order('priority', { ascending: false })

  const myChores: ChoreWithAssignee[] = (myChoreRows ?? []).map(c => ({
    ...c,
    rotation_members: Array.isArray(c.rotation_members) ? c.rotation_members as string[] : [],
    assignee: profile as UserRow,
  }))

  const myOverdue = myChores.filter(c => c.due_date! < today)
  const myToday   = myChores.filter(c => c.due_date === today)

  // ── 4. Weekly stats ───────────────────────────────────────────────────────
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7  // 0=Mon … 6=Sun
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const [
    { count: weekCompleted },
    { count: weekRecurringCompleted },
    { count: totalActive },
  ] = await Promise.all([
    supabase.from('chores').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).eq('status', 'completed')
      .gte('completed_at', weekStart.toISOString()).lte('completed_at', weekEnd.toISOString()),
    supabase.from('chores').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).neq('frequency', 'one-time')
      .gte('last_completed_at', weekStart.toISOString()).lte('last_completed_at', weekEnd.toISOString()),
    supabase.from('chores').select('*', { count: 'exact', head: true })
      .eq('household_id', householdId).neq('status', 'completed'),
  ])

  const weekDoneCount    = (weekCompleted ?? 0) + (weekRecurringCompleted ?? 0)
  const totalActiveCount = totalActive ?? 0

  // ── 5. Leaderboard: points this week + all-time ───────────────────────────
  const [{ data: weekPointRows }, { data: allTimePointRows }] = await Promise.all([
    supabase.from('point_events')
      .select('user_id, points')
      .eq('household_id', householdId)
      .gte('earned_at', weekStart.toISOString()),
    supabase.from('point_events')
      .select('user_id, points')
      .eq('household_id', householdId),
  ])

  const weekByUser    = aggregatePoints(weekPointRows    ?? [])
  const allTimeByUser = aggregatePoints(allTimePointRows ?? [])

  // Build leaderboard — include all members even with 0 points
  const leaderboard: LeaderboardEntry[] = memberUserIds
    .map(uid => ({
      userId:         uid,
      name:           profileMap[uid]?.full_name ?? null,
      avatarUrl:      profileMap[uid]?.avatar_url ?? null,
      color:          colorMap[uid] ?? '#6366f1',
      pointsThisWeek: weekByUser.get(uid) ?? 0,
      pointsAllTime:  allTimeByUser.get(uid) ?? 0,
    }))
    .sort((a, b) => b.pointsThisWeek - a.pointsThisWeek || b.pointsAllTime - a.pointsAllTime)

  // ── 6. Household name + my streak + pinned announcements ─────────────────
  const [{ data: household }, { data: myStreak }, { data: pinnedRows }] = await Promise.all([
    supabase.from('households').select('name').eq('id', householdId).maybeSingle(),
    supabase
      .from('user_streaks')
      .select('current_streak, total_completions')
      .eq('user_id',      user.id)
      .eq('household_id', householdId)
      .maybeSingle(),
    supabase
      .from('announcements')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_pinned', true)
      .order('pinned_at', { ascending: false })
      .limit(3),
  ])

  // Enrich announcements with author names
  const pinnedAuthorIds = [...new Set((pinnedRows ?? []).map(a => a.created_by))]
  const { data: pinnedAuthors } = pinnedAuthorIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url, email').in('id', pinnedAuthorIds)
    : { data: [] }
  const pinnedAuthorMap = Object.fromEntries((pinnedAuthors ?? []).map(p => [p.id, p as UserRow]))

  const pinnedAnnouncements: AnnouncementWithAuthor[] = (pinnedRows ?? []).map(a => ({
    ...a,
    author: pinnedAuthorMap[a.created_by] ?? null,
  }))

  return (
    <DashboardClient
      currentUser={profile as UserRow}
      myOverdueChores={myOverdue}
      myTodayChores={myToday}
      weekDoneCount={weekDoneCount}
      totalActiveCount={totalActiveCount}
      householdName={household?.name ?? 'Your Household'}
      householdId={householdId}
      colorMap={colorMap}
      leaderboard={leaderboard}
      myStreak={myStreak ?? null}
      pinnedAnnouncements={pinnedAnnouncements}
    />
  )
}

function aggregatePoints(rows: { user_id: string; points: number }[]) {
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.user_id, (map.get(row.user_id) ?? 0) + row.points)
  }
  return map
}
