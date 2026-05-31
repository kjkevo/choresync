import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SocialClient from './SocialClient'
import BottomNav from '@/components/ui/BottomNav'
import type {
  UserRow,
  MessageRow,
  MessageReactionRow,
  AnnouncementRow,
  MessageWithMeta,
  AnnouncementWithAuthor,
} from '@/lib/types/database'

export const metadata: Metadata = { title: 'Chat & Announcements' }
export const dynamic = 'force-dynamic'

// ── Guest screen (not signed in) ──────────────────────────────────────────────
function ChatGuestScreen() {
  return (
    <>
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
        padding: '0 24px 88px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
        <h1 style={{
          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
          fontSize: 22, color: '#111827', margin: '0 0 10px',
        }}>
          Household Chat
        </h1>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: '0 0 32px', maxWidth: 300 }}>
          Sign in to message your household members in real time.
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
      </div>
      <BottomNav />
    </>
  )
}

// ── No household screen ───────────────────────────────────────────────────────
function NoHouseholdScreen() {
  return (
    <>
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
        padding: '0 24px 88px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
        <h1 style={{
          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
          fontSize: 22, color: '#111827', margin: '0 0 10px',
        }}>
          Join a Household
        </h1>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: '0 0 32px', maxWidth: 300 }}>
          You need to be part of a household to use chat. Create or join one to get started.
        </p>
        <a href="/onboarding" style={{
          display: 'inline-block',
          background: '#FF6B2B', color: '#fff',
          borderRadius: 14, padding: '14px 36px',
          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
          fontSize: 15, textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
        }}>
          Set up household
        </a>
      </div>
      <BottomNav />
    </>
  )
}

export default async function SocialPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in — show chat page with sign-in prompt (no redirect)
  if (!user) return <ChatGuestScreen />

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profileRaw }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id).maybeSingle(),
  ])
  const profile = profileRaw as UserRow | null

  // Signed in but no household yet — show join prompt (no redirect)
  if (!membership) return <NoHouseholdScreen />

  const { household_id: householdId, role } = membership
  const isAdmin = role === 'admin'

  // ── 2. All household members ──────────────────────────────────────────────
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

  // ── 3. Last 80 messages + their reactions ─────────────────────────────────
  const { data: rawMessagesRaw } = await supabase
    .from('messages')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(80)

  const messages = ((rawMessagesRaw ?? []) as MessageRow[]).reverse()
  const messageIds = messages.map(m => m.id)

  const { data: reactionsRaw } = messageIds.length
    ? await supabase.from('message_reactions').select('*').in('message_id', messageIds)
    : { data: [] as MessageReactionRow[] }

  const reactionsByMessage: Record<string, MessageReactionRow[]> = {}
  for (const r of (reactionsRaw ?? []) as MessageReactionRow[]) {
    ;(reactionsByMessage[r.message_id] ??= []).push(r)
  }

  const enrichedMessages: MessageWithMeta[] = messages.map(m => ({
    ...m,
    author:    profileMap[m.user_id] ?? null,
    reactions: reactionsByMessage[m.id] ?? [],
  }))

  // ── 4. Announcements ──────────────────────────────────────────────────────
  const { data: rawAnnouncementsRaw } = await supabase
    .from('announcements')
    .select('*')
    .eq('household_id', householdId)
    .order('is_pinned',   { ascending: false })
    .order('created_at',  { ascending: false })

  const rawAnnouncements = (rawAnnouncementsRaw ?? []) as AnnouncementRow[]
  const enrichedAnnouncements: AnnouncementWithAuthor[] = rawAnnouncements.map(a => ({
    ...a,
    author: profileMap[a.created_by] ?? null,
  }))

  // ── 5. Household name ─────────────────────────────────────────────────────
  const { data: householdRaw } = await supabase
    .from('households').select('name').eq('id', householdId).maybeSingle()
  const household = householdRaw as { name: string } | null

  const members = memberUserIds.map(uid => ({
    id:        uid,
    name:      profileMap[uid]?.full_name ?? null,
    avatarUrl: profileMap[uid]?.avatar_url ?? null,
    color:     colorMap[uid] ?? '#6366f1',
  }))

  return (
    <SocialClient
      currentUser={profile as UserRow}
      currentUserId={user.id}
      householdId={householdId}
      householdName={household?.name ?? 'Your Household'}
      isAdmin={isAdmin}
      initialMessages={enrichedMessages}
      announcements={enrichedAnnouncements}
      members={members}
      colorMap={colorMap}
    />
  )
}
