import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import BottomNav from '@/components/ui/BottomNav'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Profile' }

// ── Guest screen (not signed in) ──────────────────────────────────────────────
function ProfileGuestScreen() {
  return (
    <>
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
        padding: '0 24px 88px',
        textAlign: 'center',
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#E5E7EB', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}>
          👤
        </div>
        <h1 style={{
          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
          fontSize: 22, color: '#111827', margin: '0 0 10px',
        }}>
          Your Profile
        </h1>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: '0 0 32px', maxWidth: 300 }}>
          Sign in to view your stats, badges, household, and account settings.
        </p>
        <a href="/login" style={{
          display: 'inline-block',
          background: '#FF6B2B', color: '#fff',
          borderRadius: 14, padding: '14px 36px',
          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
          fontSize: 15, textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
        }}>
          Sign in
        </a>
        <a href="/login?tab=signup" style={{
          display: 'inline-block', marginTop: 14,
          color: '#FF6B2B', fontWeight: 700, fontSize: 14,
          textDecoration: 'none', fontFamily: '"Nunito", sans-serif',
        }}>
          Create account →
        </a>
      </div>
      <BottomNav />
    </>
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in — show profile page with sign-in prompt (no redirect)
  if (!user) return <ProfileGuestScreen />

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
