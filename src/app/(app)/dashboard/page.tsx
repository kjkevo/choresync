import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { ActivityEntry } from './DashboardClient'
import type {
  ChoreRow,
  ChoreWithAssignee,
  UserRow,
  AnnouncementRow,
  AnnouncementWithAuthor,
  ChoreCompletionRow,
} from '@/lib/types/database'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profileRaw }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, role, color_theme').eq('user_id', user.id).maybeSingle(),
  ])
  const profile = profileRaw as UserRow | null

  if (!membership) redirect('/onboarding')

  const { household_id: householdId } = membership

  // ── 2. All members (color map + profile lookup) ───────────────────────────
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

  // ── 3. My chores: today + overdue ─────────────────────────────────────────
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

  // ── 4. Household name + my streak + pinned announcements ─────────────────
  const [{ data: householdRaw }, { data: myStreak }, { data: pinnedRowsRaw }] = await Promise.all([
    supabase.from('households').select('name').eq('id', householdId).maybeSingle(),
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
  ])

  const household  = householdRaw  as { name: string } | null
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

  // ── 5. Recent activity feed ───────────────────────────────────────────────
  const { data: completionsRaw } = await supabase
    .from('chore_completions')
    .select('*')
    .eq('household_id', householdId)
    .order('completed_at', { ascending: false })
    .limit(15)

  const recentActivity: ActivityEntry[] = ((completionsRaw ?? []) as ChoreCompletionRow[]).map(row => ({
    id:          row.id,
    choreName:   row.chore_name,
    category:    row.category,
    completedAt: row.completed_at,
    points:      row.points,
    wasOnTime:   row.was_on_time,
    member: profileMap[row.completed_by]
      ? {
          id:       row.completed_by,
          name:     profileMap[row.completed_by].full_name,
          avatarUrl:profileMap[row.completed_by].avatar_url,
          color:    colorMap[row.completed_by] ?? '#6366f1',
        }
      : null,
  }))

  return (
    <DashboardClient
      currentUser={profile as UserRow}
      myOverdueChores={myOverdue}
      myTodayChores={myToday}
      householdName={household?.name ?? 'Your Household'}
      householdId={householdId}
      colorMap={colorMap}
      myStreak={myStreak ?? null}
      pinnedAnnouncements={pinnedAnnouncements}
      recentActivity={recentActivity}
    />
  )
}
