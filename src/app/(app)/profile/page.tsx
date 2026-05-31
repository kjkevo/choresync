import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import BottomNav from '@/components/ui/BottomNav'
import type { UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Profile' }

// ── Demo profile (shown when not signed in) ───────────────────────────────────

const ICON_BG: Record<string, { bg: string; fg: string }> = {
  purple: { bg: '#EEEDFE', fg: '#534AB7' },
  teal:   { bg: '#E1F5EE', fg: '#0F6E56' },
  amber:  { bg: '#FAEEDA', fg: '#854F0B' },
  coral:  { bg: '#FAECE7', fg: '#993C1D' },
  blue:   { bg: '#E6F1FB', fg: '#185FA5' },
  pink:   { bg: '#FBEAF0', fg: '#993556' },
}

function DemoIcon({ color, icon }: { color: keyof typeof ICON_BG; icon: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16,
      background: ICON_BG[color].bg,
    }}>
      <span style={{ color: ICON_BG[color].fg }}>{icon}</span>
    </div>
  )
}

function DemoChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function DemoRow({
  color, icon, label, sub, right, last, noChevron,
}: {
  color:      keyof typeof ICON_BG
  icon:       string
  label:      string
  labelColor?: string
  sub?:       string
  right?:     React.ReactNode
  last?:      boolean
  noChevron?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 16px',
      borderBottom: last ? 'none' : '0.5px solid #F3F4F6',
    }}>
      <DemoIcon color={color} icon={icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, color: '#111827', display: 'block', fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginTop: 1 }}>{sub}</span>}
      </div>
      {right ?? (!noChevron && <DemoChevron />)}
    </div>
  )
}

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#9CA3AF',
        padding: '10px 16px 5px',
        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
      }}>
        {title}
      </div>
      <div style={{ background: '#fff' }}>{children}</div>
    </div>
  )
}

function ProfileDemoScreen() {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`}</style>
      <div style={{
        minHeight: '100dvh', background: '#F2F2F7',
        fontFamily: '"Nunito", sans-serif', paddingBottom: 88,
      }}>

        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, background: '#fff',
          borderBottom: '1px solid #F0F0F0',
          padding: '14px 16px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            My Profile
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: '#FFF3EE', color: '#FF6B2B',
            borderRadius: 20, padding: '2px 8px',
          }}>
            DEMO
          </span>
        </div>

        {/* Hero */}
        <div style={{
          background: '#fff', padding: '20px 16px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          borderBottom: '0.5px solid #E5E7EB',
        }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#E6F1FB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 600, color: '#0C447C',
              fontFamily: '"Poppins", sans-serif',
            }}>
              JR
            </div>
            <div style={{
              position: 'absolute', bottom: 1, right: 1, width: 22, height: 22,
              borderRadius: '50%', background: '#EAF3DE', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            }}>
              ✏️
            </div>
          </div>

          <p style={{ fontSize: 18, fontWeight: 500, color: '#111827', margin: 0, fontFamily: '"Poppins", sans-serif' }}>
            Jordan Rivera
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            Sunrise Apartment · Admin
          </p>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FAEEDA', color: '#633806' }}>
              🔥 14-day streak
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EAF3DE', color: '#27500A' }}>
              🏆 Top cleaner
            </span>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #E5E7EB' }}>
          {[
            { num: '142', label: 'Chores done'  },
            { num: '94%', label: 'On-time rate' },
            { num: '870', label: 'Points'        },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '12px 8px',
              borderRight: i < 2 ? '0.5px solid #E5E7EB' : 'none',
            }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#111827', display: 'block', fontFamily: '"Poppins", sans-serif' }}>
                {s.num}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Identity */}
        <DemoSection title="Identity">
          <DemoRow color="purple" icon="👤" label="Display name & avatar" sub="Jordan Rivera · color: blue" />
          <DemoRow color="purple" icon="@"  label="Username"              sub="@jordanr" />
          <DemoRow color="purple" icon="😊" label="Personal tagline"      sub='"I always do the dishes first"' last />
        </DemoSection>

        <div style={{ height: 8, background: '#F2F2F7' }} />

        {/* Stats & achievements */}
        <DemoSection title="Stats & achievements">
          <DemoRow color="amber" icon="🏅" label="Badges & achievements" sub="8 earned · 3 locked" />
          <DemoRow color="amber" icon="📊" label="My chore history"      sub="Full log of completed tasks" />
          <DemoRow color="amber" icon="⚖️" label="My fairness score"     sub="You're carrying 38% of the load" />
          <DemoRow color="amber" icon="🎁" label="Rewards & points"      sub="870 pts · 2 rewards available" last />
        </DemoSection>

        <div style={{ height: 8, background: '#F2F2F7' }} />

        {/* Preferences */}
        <DemoSection title="Preferences">
          <DemoRow color="teal" icon="🔔" label="Notifications"    sub="Quiet hours: 10pm – 8am" />
          <DemoRow color="teal" icon="🌙" label="Appearance"       sub="Dark mode · System default" />
          <DemoRow color="teal" icon="🌐" label="Language & region" sub="English · US" />
          <DemoRow color="teal" icon="📅" label="Calendar sync"    sub="Linked to Google Calendar" last />
        </DemoSection>

        <div style={{ height: 8, background: '#F2F2F7' }} />

        {/* Household */}
        <DemoSection title="Household">
          <DemoRow color="blue" icon="🏠" label="My households"  sub="Sunrise Apt · Mom's house" />
          <DemoRow color="blue" icon="👥" label="Members"        sub="4 members · you're admin" />
          <DemoRow color="blue" icon="🔗" label="Invite someone" sub="Share a link or send an email" last />
        </DemoSection>

        <div style={{ height: 8, background: '#F2F2F7' }} />

        {/* Account & privacy */}
        <DemoSection title="Account & privacy">
          <DemoRow color="coral" icon="🔒" label="Change password" sub="Last changed 3 months ago" />
          <DemoRow color="coral" icon="✉️" label="Email address"   sub="jordan@email.com" />
          <DemoRow color="coral" icon="🛡️" label="Privacy & data"  sub="Export or delete your data" />
          <DemoRow color="pink"  icon="🚪" label="Sign out" noChevron last />
        </DemoSection>

        {/* Sign in CTA */}
        <div style={{
          margin: '24px 16px 8px',
          background: '#fff', borderRadius: 16,
          padding: '20px', textAlign: 'center',
          border: '1.5px solid #FFD5C2',
        }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111827', fontFamily: '"Poppins", sans-serif' }}>
            Ready to track your chores?
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
            Sign in to see your real stats and profile.
          </p>
          <a href="/login" style={{
            display: 'inline-block',
            background: '#FF6B2B', color: '#fff',
            borderRadius: 12, padding: '11px 32px',
            fontFamily: '"Poppins", sans-serif', fontWeight: 700,
            fontSize: 14, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
          }}>
            Sign in
          </a>
        </div>

      </div>
      <BottomNav />
    </>
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in — show demo profile
  if (!user) return <ProfileDemoScreen />

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
