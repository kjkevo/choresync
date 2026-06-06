import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from './CalendarClient'
import type { ChoreRow, ChoreWithAssignee, UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/calendar')

  const [{ data: _profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, color_theme').eq('user_id', user.id).maybeSingle(),
  ])

  if (!membership) redirect('/onboarding')
  const { household_id: householdId } = membership

  // Members + profiles
  const { data: memberRowsRaw } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberRows = (memberRowsRaw ?? []) as { user_id: string; color_theme: string }[]
  const memberUserIds = memberRows.map(m => m.user_id)
  const colorMap = Object.fromEntries(memberRows.map(m => [m.user_id, m.color_theme]))

  const [{ data: memberProfilesRaw }, { data: choreRowsRaw }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').in('id', memberUserIds),
    supabase
      .from('chores')
      .select('*')
      .eq('household_id', householdId)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true }),
  ])

  const { data: householdData } = await supabase
    .from('households').select('name').eq('id', householdId).maybeSingle()
  const household = householdData as { name: string } | null

  const memberProfiles = (memberProfilesRaw ?? []) as UserRow[]
  const choreRowsTyped = (choreRowsRaw ?? []) as ChoreRow[]

  const profileMap: Record<string, UserRow> = Object.fromEntries(
    memberProfiles.map(p => [p.id, p])
  )

  const chores: ChoreWithAssignee[] = choreRowsTyped.map(c => ({
    ...c,
    rotation_members: Array.isArray(c.rotation_members) ? c.rotation_members as unknown as string[] : [],
    assignee: c.assigned_to ? (profileMap[c.assigned_to] ?? null) : null,
  }))

  const members = memberUserIds.map(uid => ({
    id:        uid,
    name:      profileMap[uid]?.full_name ?? null,
    avatarUrl: profileMap[uid]?.avatar_url ?? null,
    color:     colorMap[uid] ?? '#6366f1',
  }))

  return (
    <CalendarClient
      chores={chores}
      members={members}
      currentUserId={user.id}
      householdName={household?.name ?? 'Your Household'}
    />
  )
}
