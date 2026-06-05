import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { gcal } = await searchParams

  // TODO: re-enable before launch
  // No session → render a preview profile. ProfileClient will hydrate the
  // visible fields from sessionStorage if onboarding was completed in preview.
  if (!user) {
    const guestUser = {
      id: '', email: '', user_metadata: {}, app_metadata: {},
      aud: 'authenticated', created_at: '',
    } as unknown as Parameters<typeof ProfileClient>[0]['user']
    const guestProfile: UserRow = {
      id: '', email: '', full_name: null, avatar_url: null,
      username: null, tagline: null,
      google_calendar_refresh_token: null,
      created_at: '', updated_at: '',
    }
    return (
      <ProfileClient
        user={guestUser}
        profile={guestProfile}
        membership={null}
        householdId={null}
        members={[]}
        streak={null}
        stats={{ totalChores: 0, onTimeRate: null, totalPoints: 0 }}
        isTopEarner={false}
        initialUsername=""
        initialTagline=""
        googleCalendarConnected={false}
        gcalStatus={null}
        allHouseholds={[]}
      />
    )
  }

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

  // ── 6. All households the user belongs to (for multi-household section) ──
  const { data: allMembershipRowsRaw } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)

  const allMembershipRows = (allMembershipRowsRaw ?? []) as { household_id: string; role: string }[]
  const allHouseholdIds   = allMembershipRows.map(m => m.household_id)

  const { data: allHouseholdsRaw } = allHouseholdIds.length
    ? await supabase
        .from('households')
        .select('id, name, invite_code')
        .in('id', allHouseholdIds)
    : { data: [] }

  const householdById = Object.fromEntries(
    ((allHouseholdsRaw ?? []) as { id: string; name: string; invite_code: string }[]).map(h => [h.id, h])
  )

  const allHouseholds = allMembershipRows.map(m => ({
    id:         m.household_id,
    name:       householdById[m.household_id]?.name       ?? 'Unknown',
    role:       m.role                                    as 'admin' | 'member' | 'kids',
    inviteCode: householdById[m.household_id]?.invite_code ?? '',
  }))

  const profileRow = profile as UserRow
  const googleCalendarConnected = !!profileRow?.google_calendar_refresh_token

  // Map the ?gcal= query param coming back from the OAuth callback
  // into a typed status the client can render as a toast.
  type GcalStatus = 'connected' | 'denied' | 'error' | 'not_configured' | null
  const gcalStatus: GcalStatus =
    gcal === 'connected'      ? 'connected'      :
    gcal === 'denied'         ? 'denied'         :
    gcal === 'error'          ? 'error'          :
    gcal === 'not_configured' ? 'not_configured' :
    null

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
      googleCalendarConnected={googleCalendarConnected}
      gcalStatus={gcalStatus}
      allHouseholds={allHouseholds}
    />
  )
}
