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

// ── Demo chat (shown when not signed in) ──────────────────────────────────────

const DEMO_MEMBERS = [
  { id: 'd1', name: 'Jordan Rivera', color: '#FF6B2B', initials: 'JR', emoji: null },
  { id: 'd2', name: 'Alex Kim',      color: '#6366F1', initials: 'AK', emoji: null },
  { id: 'd3', name: 'Sam Torres',    color: '#10B981', initials: 'ST', emoji: null },
  { id: 'd4', name: 'Riley Chen',    color: '#8B5CF6', initials: 'RC', emoji: null },
]

const DEMO_MESSAGES = [
  { id: 'm1', uid: 'd2', text: 'Hey everyone, whose turn is it to take out the trash?', time: '9:14 AM' },
  { id: 'm2', uid: 'd3', text: 'I did it last week! 😅', time: '9:15 AM' },
  { id: 'm3', uid: 'd1', text: 'I think it\'s Riley\'s turn this week', time: '9:16 AM' },
  { id: 'm4', uid: 'd4', text: 'On it! Also I restocked the dish soap 🧼', time: '9:18 AM' },
  { id: 'm5', uid: 'd2', text: 'You\'re the best Riley 🙌', time: '9:19 AM' },
  { id: 'm6', uid: 'd3', text: 'I finished vacuuming the living room btw', time: '9:45 AM' },
  { id: 'm7', uid: 'd1', text: 'Nice work Sam! Kitchen is done too ✅', time: '9:47 AM' },
  { id: 'm8', uid: 'd4', text: 'We\'re all crushing it this week 🔥', time: '10:02 AM' },
  { id: 'm9', uid: 'd2', text: 'Should we do a deep clean this Saturday?', time: '10:15 AM' },
  { id: 'm10', uid: 'd1', text: 'Yes! Let\'s make a plan in the app', time: '10:16 AM' },
  { id: 'm11', uid: 'd3', text: 'I\'m in 👍', time: '10:17 AM' },
  { id: 'm12', uid: 'd4', text: 'Same, works for me 👌', time: '10:17 AM' },
]

function DemoAvatar({ member, size = 32 }: { member: typeof DEMO_MEMBERS[0]; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: member.color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: '#fff',
    }}>
      {member.initials}
    </div>
  )
}

function ChatDemoScreen() {
  const memberMap = Object.fromEntries(DEMO_MEMBERS.map(m => [m.id, m]))

  return (
    <>
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
      }}>
        {/* Header */}
        <header style={{ flexShrink: 0, background: '#fff', boxShadow: '0 1px 0 #E5E7EB' }}>
          <div style={{ padding: '14px 20px 0', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 17, color: '#111827' }}>
                Sunrise Apartment
              </span>
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: '#FFF3EE', color: '#FF6B2B',
                borderRadius: 20, padding: '2px 8px',
              }}>
                DEMO
              </span>
            </div>
          </div>
          {/* Tab strip */}
          <div style={{ display: 'flex', maxWidth: 640, margin: '12px auto 0' }}>
            <div style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 800,
              fontFamily: '"Nunito", sans-serif', color: '#FF6B2B', textAlign: 'center',
              borderBottom: '2.5px solid #FF6B2B',
            }}>
              💬 Chat
            </div>
            <div style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 800,
              fontFamily: '"Nunito", sans-serif', color: '#9CA3AF', textAlign: 'center',
              borderBottom: '2.5px solid transparent',
            }}>
              📌 Announcements
            </div>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DEMO_MESSAGES.map((msg, idx) => {
              const member = memberMap[msg.uid]
              const isMe = msg.uid === 'd1'
              const prevSame = idx > 0 && DEMO_MESSAGES[idx - 1].uid === msg.uid

              return (
                <div key={msg.id} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  marginTop: prevSame ? -8 : 4,
                }}>
                  {/* Avatar */}
                  <div style={{ width: 32, flexShrink: 0, opacity: prevSame ? 0 : 1 }}>
                    {!prevSame && <DemoAvatar member={member} size={32} />}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: '72%', display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3,
                  }}>
                    {!prevSame && (
                      <div style={{
                        display: 'flex', gap: 6, alignItems: 'baseline',
                        flexDirection: isMe ? 'row-reverse' : 'row',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: member.color }}>
                          {isMe ? 'You' : member.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{msg.time}</span>
                      </div>
                    )}
                    <div style={{
                      background: isMe ? '#FF6B2B' : '#fff',
                      color: isMe ? '#fff' : '#111827',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '9px 14px', fontSize: 14, lineHeight: 1.5,
                      boxShadow: isMe
                        ? '0 2px 10px rgba(255,107,43,0.25)'
                        : '0 1px 4px rgba(0,0,0,0.08)',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Input bar (disabled demo) */}
        <div style={{
          flexShrink: 0, borderTop: '1px solid #E5E7EB',
          background: '#fff', padding: '10px 16px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 640, margin: '0 auto' }}>
            <DemoAvatar member={DEMO_MEMBERS[0]} size={32} />
            <div style={{
              flex: 1, borderRadius: 20, border: '1.5px solid #E5E7EB',
              background: '#F7F8FA', padding: '9px 16px',
              fontSize: 14, color: '#9CA3AF', fontFamily: '"Nunito", sans-serif',
            }}>
              Sign in to send messages…
            </div>
            <a href="/login" style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#FF6B2B', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', flexShrink: 0,
              boxShadow: '0 3px 10px rgba(255,107,43,0.35)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            </a>
          </div>
        </div>

        <div style={{ height: 68, flexShrink: 0 }} />
      </div>
      <BottomNav />
    </>
  )
}

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in — show demo chat
  if (!user) return <ChatDemoScreen />

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profileRaw }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members')
      .select('household_id, role, color_theme')
      .eq('user_id', user.id).maybeSingle(),
  ])
  const profile = profileRaw as UserRow | null

  if (!membership) return <ChatDemoScreen />

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
