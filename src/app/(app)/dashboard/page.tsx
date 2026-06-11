import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { ActivityEntry, HouseholdSummary, HouseholdChoreRow, LeaderboardEntry } from './DashboardClient'
import type {
  ChoreRow,
  ChoreWithAssignee,
  UserRow,
  AnnouncementRow,
  AnnouncementWithAuthor,
  ChoreCompletionRow,
} from '@/lib/types/database'
import type { ReactionEntry } from './DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>
}) {
  const supabase = await createClient()
  const params   = await searchParams

  const { data: { user } } = await supabase.auth.getUser()

  // if (!user) redirect('/login') // TODO: re-enable
  // Guest mode — render the dashboard shell; DashboardClient hydrates
  // members + chores from sessionStorage preview data after onboarding.
  if (!user) {
    const guest: UserRow = {
      id: '', email: '', full_name: 'Guest', avatar_url: null,
      username: null, tagline: null, google_calendar_refresh_token: null,
      created_at: '', updated_at: '',
    }
    return (
      <DashboardClient
        currentUser={guest}
        myOverdueChores={[]}
        myTodayChores={[]}
        householdName="Your Household"
        householdId=""
        colorMap={{}}
        myStreak={null}
        pinnedAnnouncements={[]}
        recentActivity={[]}
        allHouseholds={[]}
        householdAllChores={[]}
        leaderboard={[]}
        members={[]}
      />
    )
  }

  // ── 1. Profile + ALL memberships ─────────────────────────────────────────
  const [{ data: profileRaw }, { data: allMemberships }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id),
  ])
  const profile = profileRaw as UserRow | null

  // No household yet — check if this is immediately after household creation
  // If so, try one more time with a small delay to allow database to catch up
  let allMembershipsData = allMemberships
  if (!allMemberships || allMemberships.length === 0) {
    // Wait a bit for database write to propagate
    await new Promise(resolve => setTimeout(resolve, 100))
    const { data: retryMemberships } = await supabase
      .from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id)
    allMembershipsData = retryMemberships

    // Still nothing — redirect to onboarding
    if (!allMembershipsData || allMembershipsData.length === 0) {
      redirect('/onboarding')
    }
  }

  // Pick active household: prefer ?h= param, else first membership
  const allHouseholdIds = allMembershipsData!.map(m => m.household_id)
  const requestedId     = params.h && allHouseholdIds.includes(params.h) ? params.h : null
  const activeMembership = requestedId
    ? allMembershipsData!.find(m => m.household_id === requestedId)!
    : allMembershipsData![0]

  const { household_id: householdId } = activeMembership

  // ── 2. Fetch household names for switcher ─────────────────────────────────
  const { data: householdRowsRaw } = await supabase
    .from('households')
    .select('id, name')
    .in('id', allHouseholdIds)

  const allHouseholds: HouseholdSummary[] = (householdRowsRaw ?? []).map(h => ({
    id:   h.id as string,
    name: h.name as string,
  }))

  // ── 3. All members (color map + profile lookup) ───────────────────────────
  const { data: memberRowsRaw } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberRows     = (memberRowsRaw ?? []) as { user_id: string; color_theme: string }[]
  const memberUserIds  = memberRows.map(m => m.user_id)
  const colorMap       = Object.fromEntries(memberRows.map(m => [m.user_id, m.color_theme]))

  const { data: memberProfilesRaw } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const memberProfiles = (memberProfilesRaw ?? []) as UserRow[]
  const profileMap: Record<string, UserRow> = Object.fromEntries(memberProfiles.map(p => [p.id, p]))

  // ── 4. My chores: today + overdue ─────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const { data: myChoreRowsRaw } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .eq('assigned_to', user.id)
    .eq('status', 'incomplete')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .order('priority', { ascending: false })

  const myChoreRows = (myChoreRowsRaw ?? []) as ChoreRow[]
  const myChores: ChoreWithAssignee[] = myChoreRows.map(c => ({
    ...c,
    rotation_members: Array.isArray(c.rotation_members) ? c.rotation_members as unknown as string[] : [],
    assignee: profile,
  }))

  const myOverdue = myChores.filter(c => c.due_date! < today)
  const myToday   = myChores.filter(c => c.due_date === today)

  // ── 4b. All household chores for the overview section ────────────────────
  const { data: allChoreRowsRaw } = await supabase
    .from('chores')
    .select('id, name, status, assigned_to, points, category')
    .eq('household_id', householdId)
    .order('due_date', { ascending: true })
    .limit(30)

  const householdAllChores: HouseholdChoreRow[] = ((allChoreRowsRaw ?? []) as {
    id: string; name: string; status: string; assigned_to: string | null; points: number; category: string
  }[]).map(c => ({
    id:           c.id,
    name:         c.name,
    status:       (c.status === 'completed' ? 'complete' : 'incomplete') as 'incomplete' | 'complete',
    assigned_to:  c.assigned_to,
    assigneeName: c.assigned_to ? (profileMap[c.assigned_to]?.full_name ?? 'Unknown') : null,
    points:       c.points ?? 0,
    category:     c.category ?? 'general',
  }))

  // ── 5. Household name + my streak + pinned announcements ─────────────────
  const activeHousehold = allHouseholds.find(h => h.id === householdId)

  const [{ data: myStreak }, { data: pinnedRowsRaw }, { data: myPointsRaw }] = await Promise.all([
    supabase.from('user_streaks')
      .select('current_streak, total_completions')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .maybeSingle(),
    supabase.from('announcements')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_pinned', true)
      .order('pinned_at', { ascending: false })
      .limit(3),
    supabase.from('point_events')
      .select('points')
      .eq('user_id', user.id)
      .eq('household_id', householdId),
  ])

  const myTotalPoints = ((myPointsRaw ?? []) as { points: number }[]).reduce((sum, r) => sum + r.points, 0)
  const myStreakWithPoints = myStreak ? { ...myStreak, total_completions: myTotalPoints } : null

  const pinnedRows = (pinnedRowsRaw ?? []) as AnnouncementRow[]

  const pinnedAuthorIds = [...new Set(pinnedRows.map(a => a.created_by))]
  const { data: pinnedAuthorsRaw } = pinnedAuthorIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url, email').in('id', pinnedAuthorIds)
    : { data: [] as UserRow[] }

  const pinnedAuthorMap: Record<string, UserRow> = Object.fromEntries(
    ((pinnedAuthorsRaw ?? []) as UserRow[]).map(p => [p.id, p])
  )
  const pinnedAnnouncements: AnnouncementWithAuthor[] = pinnedRows.map(a => ({
    ...a,
    author: pinnedAuthorMap[a.created_by] ?? null,
  }))

  // ── 6. Leaderboard — ranked by real accumulated points from point_events ───
  const [{ data: allStreaksRaw }, { data: pointTotalsRaw }] = await Promise.all([
    supabase
      .from('user_streaks')
      .select('user_id, total_completions, current_streak')
      .eq('household_id', householdId)
      .limit(20),
    supabase
      .from('point_events')
      .select('user_id, points')
      .eq('household_id', householdId),
  ])

  // Sum points per user from point_events
  const pointsByUser: Record<string, number> = {}
  for (const row of (pointTotalsRaw ?? []) as { user_id: string; points: number }[]) {
    pointsByUser[row.user_id] = (pointsByUser[row.user_id] ?? 0) + row.points
  }

  const streakMap: Record<string, { total_completions: number; current_streak: number }> =
    Object.fromEntries(
      ((allStreaksRaw ?? []) as { user_id: string; total_completions: number; current_streak: number }[])
        .map(s => [s.user_id, s])
    )

  const leaderboard: LeaderboardEntry[] = memberUserIds.map(uid => ({
    userId:        uid,
    name:          profileMap[uid]?.full_name ?? null,
    avatarUrl:     profileMap[uid]?.avatar_url ?? null,
    color:         colorMap[uid] ?? '#6366f1',
    totalPoints:   pointsByUser[uid] ?? 0,
    currentStreak: streakMap[uid]?.current_streak ?? 0,
  })).sort((a, b) => b.totalPoints - a.totalPoints)

  // ── 7. Recent activity feed ───────────────────────────────────────────────
  const { data: completionsRaw } = await supabase
    .from('chore_completions')
    .select('*')
    .eq('household_id', householdId)
    .order('completed_at', { ascending: false })
    .limit(15)

  const completionIds = ((completionsRaw ?? []) as ChoreCompletionRow[]).map(r => r.id)
  const { data: reactionsRaw } = completionIds.length > 0
    ? await supabase
        .from('chore_completion_reactions')
        .select('completion_id, user_id, emoji')
        .in('completion_id', completionIds)
    : { data: [] }

  // Group by completion_id
  const reactionsByCompletion: Record<string, ReactionEntry[]> = {}
  for (const r of (reactionsRaw ?? []) as { completion_id: string; user_id: string; emoji: string }[]) {
    ;(reactionsByCompletion[r.completion_id] ??= []).push({ emoji: r.emoji, userId: r.user_id })
  }

  const recentActivity: ActivityEntry[] = ((completionsRaw ?? []) as ChoreCompletionRow[]).map(row => ({
    id:          row.id,
    choreName:   row.chore_name,
    category:    row.category,
    completedAt: row.completed_at,
    points:      row.points,
    wasOnTime:   row.was_on_time,
    reactions:   reactionsByCompletion[row.id] ?? [],
    member: profileMap[row.completed_by]
      ? {
          id:        row.completed_by,
          name:      profileMap[row.completed_by].full_name,
          avatarUrl: profileMap[row.completed_by].avatar_url,
          color:     colorMap[row.completed_by] ?? '#6366f1',
        }
      : null,
  }))

  const members = memberUserIds.map(uid => ({
    id:        uid,
    name:      profileMap[uid]?.full_name ?? null,
    avatarUrl: profileMap[uid]?.avatar_url ?? null,
    color:     colorMap[uid] ?? '#6366f1',
  }))

  return (
    <DashboardClient
      currentUser={profile as UserRow}
      myOverdueChores={myOverdue}
      myTodayChores={myToday}
      householdName={activeHousehold?.name ?? 'Your Household'}
      householdId={householdId}
      colorMap={colorMap}
      myStreak={myStreakWithPoints ?? null}
      pinnedAnnouncements={pinnedAnnouncements}
      recentActivity={recentActivity}
      allHouseholds={allHouseholds}
      householdAllChores={householdAllChores}
      leaderboard={leaderboard}
      members={members}
    />
  )
}
