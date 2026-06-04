import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No session → onboarding (middleware handles this first, but be defensive)
  if (!user) redirect('/onboarding')

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
  const [{ data: completions }, { data: pointEventsRaw }] = await Promise.all([
    householdId
      ? supabase
          .from('chore_completions')
          .select('was_on_time')
          .eq('completed_by', user.id)
          .eq('household_id', householdId)
      : Promise.resolve({ data: [] }),
    householdId
      ? supabase
          .from('point_events')
          .select('points')
          .eq('user_id', user.id)
          .eq('household_id', householdId)
      : Promise.resolve({ data: [] }),
  ])

  const allCompletions  = (completions ?? []) as { was_on_time: boolean | null }[]
  const totalChores     = allCompletions.length
  // Only score on-time rate against completions that had a due date.
  // Chores without a due date have was_on_time = null and should not
  // drag the percentage down or skew it in either direction.
  const datedCompletions = allCompletions.filter(c => c.was_on_time !== null)
  const onTimeCount      = datedCompletions.filter(c => c.was_on_time === true).length
  const onTimeRate: number | null = datedCompletions.length > 0
    ? Math.round((onTimeCount / datedCompletions.length) * 100)
    : null   // null = no dated chores yet → show "—" in UI
  const totalPoints = ((pointEventsRaw ?? []) as { points: number }[]).reduce((s, r) => s + r.points, 0)

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

  // ── 6. Rewards catalog count (shown in profile row sub-text) ─────────────
  const { count: rewardsCount } = householdId
    ? await supabase
        .from('rewards_catalog')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('is_active', true)
    : { count: 0 }

  const profileRow = profile as UserRow

  return (
    <ProfileClient
      user={user}
      profile={profileRow}
      membership={membership}
      householdId={householdId}
      members={members}
      streak={streakRow ?? null}
      stats={{ totalChores, onTimeRate, totalPoints }}
      isTopEarner={isTopEarner}
      initialUsername={profileRow?.username ?? ''}
      initialTagline={profileRow?.tagline  ?? ''}
      rewardsCount={rewardsCount ?? 0}
    />
  )
}
