import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SocialClient from './SocialClient'
import type {
  UserRow,
  MessageWithMeta,
  MessageReactionRow,
  AnnouncementWithAuthor,
} from '@/lib/types/database'

export const metadata: Metadata = { title: 'Chat & Announcements' }
export const dynamic = 'force-dynamic'

export default async function SocialPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!membership) redirect('/onboarding')
  const { household_id: householdId, role } = membership
  const isAdmin = role === 'admin'

  // ── 2. All household members ──────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberUserIds = (memberRows ?? []).map(m => m.user_id)
  const colorMap = Object.fromEntries((memberRows ?? []).map(m => [m.user_id, m.color_theme]))

  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const profileMap = Object.fromEntries((memberProfiles ?? []).map(p => [p.id, p as UserRow]))

  // ── 3. Last 80 messages + their reactions ─────────────────────────────────
  const { data: rawMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(80)

  const messages = (rawMessages ?? []).reverse()  // oldest-first for display
  const messageIds = messages.map(m => m.id)

  const { data: reactions } = messageIds.length
    ? await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds)
    : { data: [] }

  // Group reactions by message_id
  const reactionsByMessage: Record<string, MessageReactionRow[]> = {}
  for (const r of reactions ?? []) {
    ;(reactionsByMessage[r.message_id] ??= []).push(r as MessageReactionRow)
  }

  const enrichedMessages: MessageWithMeta[] = messages.map(m => ({
    ...m,
    author:    profileMap[m.user_id] ?? null,
    reactions: reactionsByMessage[m.id] ?? [],
  }))

  // ── 4. Announcements ──────────────────────────────────────────────────────
  const { data: rawAnnouncements } = await supabase
    .from('announcements')
    .select('*')
    .eq('household_id', householdId)
    .order('is_pinned', { ascending: false })
    .order('created_at',  { ascending: false })

  const enrichedAnnouncements: AnnouncementWithAuthor[] = (rawAnnouncements ?? []).map(a => ({
    ...a,
    author: profileMap[a.created_by] ?? null,
  }))

  // ── 5. Household name ─────────────────────────────────────────────────────
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle()

  const members = memberUserIds.map(uid => ({
    id:       uid,
    name:     profileMap[uid]?.full_name ?? null,
    avatarUrl: profileMap[uid]?.avatar_url ?? null,
    color:    colorMap[uid] ?? '#6366f1',
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
