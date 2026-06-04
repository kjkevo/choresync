import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SocialClient from './SocialClient'
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

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // TODO: re-enable before launch
  // No session → preview mode (show empty chat UI, messages can't be sent without auth)
  if (!user) {
    const guestUser: UserRow = {
      id: '', email: '', full_name: 'Guest', avatar_url: null,
      username: null, tagline: null, google_calendar_refresh_token: null,
      created_at: '', updated_at: '',
    }
    return (
      <SocialClient
        currentUser={guestUser}
        currentUserId=""
        householdId=""
        householdName="Your Household"
        isAdmin={false}
        initialMessages={[]}
        announcements={[]}
        members={[]}
        colorMap={{}}
      />
    )
  }

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profileRaw }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id).maybeSingle(),
  ])
  const profile = profileRaw as UserRow | null

  // No household → onboarding
  if (!membership) redirect('/onboarding')

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

  // ── 3. Last 80 messages ordered by timestamp, scoped to this household ────
  const { data: rawMessagesRaw } = await supabase
    .from('messages')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })   // oldest first so the list reads top→bottom
    .limit(80)

  const messages = (rawMessagesRaw ?? []) as MessageRow[]
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
