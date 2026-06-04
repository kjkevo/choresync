'use client'

import React, {
  useState, useEffect, useRef, useTransition, useCallback, useMemo,
} from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, deleteMessage, toggleReaction } from '@/lib/actions/messages'
import {
  createAnnouncement, toggleAnnouncementPin, deleteAnnouncement,
} from '@/lib/actions/announcements'
import BottomNav from '@/components/ui/BottomNav'
import type {
  UserRow, MessageWithMeta, MessageReactionRow,
  AnnouncementWithAuthor, MessageEmoji,
} from '@/lib/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJIS: MessageEmoji[] = ['👍', '❤️', '😂', '😮', '🎉', '🔥']
const ORANGE = '#FF6B2B'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function isGrouped(msgs: MessageWithMeta[], idx: number) {
  if (idx === 0) return false
  const prev = msgs[idx - 1]
  const curr = msgs[idx]
  if (prev.user_id !== curr.user_id) return false
  return new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
}

// ── Avatar component ──────────────────────────────────────────────────────────

function AvatarCircle({
  avatarUrl, name, color, size = 32,
}: {
  avatarUrl: string | null | undefined
  name:      string | null | undefined
  color:     string
  size?:     number
}) {
  const isEmoji = avatarUrl?.startsWith('emoji:')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
      fontSize: isEmoji ? size * 0.55 : size * 0.36,
      fontWeight: 700, color: '#fff',
    }}>
      {isEmoji ? (
        <span>{avatarUrl!.slice(6)}</span>
      ) : avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name ?? ''}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          unoptimized
        />
      ) : (
        <span>{initials(name ?? null)}</span>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Member {
  id:        string
  name:      string | null
  avatarUrl: string | null
  color:     string
}

interface SocialClientProps {
  currentUser:      UserRow
  currentUserId:    string
  householdId:      string
  householdName:    string
  isAdmin:          boolean
  initialMessages:  MessageWithMeta[]
  announcements:    AnnouncementWithAuthor[]
  members:          Member[]
  colorMap:         Record<string, string>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SocialClient({
  currentUser,
  currentUserId,
  householdId,
  householdName,
  isAdmin,
  initialMessages,
  announcements: initialAnnouncements,
  members,
  colorMap,
}: SocialClientProps) {
  const [tab, setTab] = useState<'chat' | 'announcements'>('chat')

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  )

  return (
    <>
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
      }}>
        {/* Header */}
        <header style={{
          flexShrink: 0, background: '#fff',
          boxShadow: '0 1px 0 #E5E7EB',
        }}>
          <div style={{ padding: '14px 20px 0', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                fontSize: 17, color: '#111827',
              }}>
                {householdName}
              </span>
            </div>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', maxWidth: 640, margin: '12px auto 0' }}>
            <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')}>
              💬 Chat
            </TabBtn>
            <TabBtn active={tab === 'announcements'} onClick={() => setTab('announcements')}>
              📌 Announcements
            </TabBtn>
          </div>
        </header>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 'chat' ? (
            <ChatTab
              householdId={householdId}
              currentUserId={currentUserId}
              currentUser={currentUser}
              initialMessages={initialMessages}
              memberById={memberById}
              colorMap={colorMap}
              isAdmin={isAdmin}
            />
          ) : (
            <AnnouncementsTab
              householdId={householdId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              initialAnnouncements={initialAnnouncements}
              memberById={memberById}
              colorMap={colorMap}
            />
          )}
        </div>

        {/* Spacer for fixed BottomNav */}
        <div style={{ height: 68, flexShrink: 0 }} />
      </div>

      <BottomNav />
    </>
  )
}

// ── Chat tab ──────────────────────────────────────────────────────────────────

function ChatTab({
  householdId, currentUserId, currentUser,
  initialMessages, memberById, colorMap, isAdmin,
}: {
  householdId:     string
  currentUserId:   string
  currentUser:     UserRow
  initialMessages: MessageWithMeta[]
  memberById:      Record<string, Member>
  colorMap:        Record<string, string>
  isAdmin:         boolean
}) {
  const [messages,    setMessages]    = useState<MessageWithMeta[]>(initialMessages)
  const [input,       setInput]       = useState('')
  const [sending,     startSend]      = useTransition()
  const [emojiFor,    setEmojiFor]    = useState<string | null>(null)
  const [deleteFor,   setDeleteFor]   = useState<string | null>(null)
  const [hoveredMsg,  setHoveredMsg]  = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const supabase  = useRef(createClient())

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { scrollToBottom() }, [scrollToBottom])

  // Real-time subscription
  useEffect(() => {
    const sb = supabase.current

    const channel = sb
      .channel(`chat-${householdId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `household_id=eq.${householdId}` },
        (payload) => {
          const newMsg = payload.new as MessageWithMeta
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            const member = memberById[newMsg.user_id] ?? null
            return [...prev, { ...newMsg, author: member as unknown as UserRow | null, reactions: [] }]
          })
          setTimeout(() => scrollToBottom(true), 50)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deleted = payload.old as { id: string }
          setMessages(prev => prev.filter(m => m.id !== deleted.id))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new as MessageReactionRow
          setMessages(prev => prev.map(m =>
            m.id !== r.message_id ? m : {
              ...m,
              reactions: m.reactions.some(x => x.id === r.id)
                ? m.reactions
                : [...m.reactions, r],
            },
          ))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const deleted = payload.old as { id: string; message_id: string }
          setMessages(prev => prev.map(m =>
            m.id !== deleted.message_id ? m : {
              ...m,
              reactions: m.reactions.filter(r => r.id !== deleted.id),
            },
          ))
        },
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [householdId, memberById, scrollToBottom])

  // Send
  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    const optimisticId = `opt-${Date.now()}`
    const optimistic: MessageWithMeta = {
      id:           optimisticId,
      household_id: householdId,
      user_id:      currentUserId,
      content:      text,
      created_at:   new Date().toISOString(),
      edited_at:    null,
      author:       currentUser as unknown as UserRow,
      reactions:    [],
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 30)

    startSend(async () => {
      const result = await sendMessage(householdId, text)
      if (result.error) {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      } else if (result.message) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...result.message!, author: currentUser as unknown as UserRow, reactions: [] }
            : m,
        ))
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleReaction(messageId: string, emoji: MessageEmoji) {
    setEmojiFor(null)
    const alreadyReacted = messages
      .find(m => m.id === messageId)
      ?.reactions.some(r => r.user_id === currentUserId && r.emoji === emoji)

    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      if (alreadyReacted) {
        return { ...m, reactions: m.reactions.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)) }
      }
      const fake: MessageReactionRow = {
        id: `opt-${Date.now()}`, message_id: messageId,
        user_id: currentUserId, emoji, created_at: new Date().toISOString(),
      }
      return { ...m, reactions: [...m.reactions, fake] }
    }))

    await toggleReaction(messageId, emoji)
  }

  async function handleDelete(messageId: string) {
    setDeleteFor(null)
    setMessages(prev => prev.filter(m => m.id !== messageId))
    await deleteMessage(messageId)
  }

  return (
    <>
      {/* Scroll area — minHeight:0 is required so flex:1 can actually shrink
          below its content height and let overflowY:auto scroll instead of
          pushing the input bar off screen */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', minHeight: 0 }}>

        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <p style={{ marginTop: 12, fontWeight: 700, color: '#374151', fontSize: 16 }}>
              No messages yet
            </p>
            <p style={{ marginTop: 4, fontSize: 13, color: '#9CA3AF' }}>
              Be the first to say hello!
            </p>
          </div>
        )}

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {messages.map((msg, idx) => {
            const grouped   = isGrouped(messages, idx)
            const isMe      = msg.user_id === currentUserId
            const color     = colorMap[msg.user_id] ?? '#6366f1'
            const member    = memberById[msg.user_id]
            const canDelete = isMe || isAdmin
            const hovered   = hoveredMsg === msg.id

            const reactionGroups: Record<string, { count: number; iMine: boolean }> = {}
            for (const r of msg.reactions) {
              if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, iMine: false }
              reactionGroups[r.emoji].count++
              if (r.user_id === currentUserId) reactionGroups[r.emoji].iMine = true
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  marginTop: grouped ? 2 : 16,
                }}
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => setHoveredMsg(null)}
              >
                {/* Avatar column */}
                <div style={{ width: 32, flexShrink: 0, opacity: grouped ? 0 : 1 }}>
                  {!grouped && (
                    <AvatarCircle
                      avatarUrl={member?.avatarUrl}
                      name={member?.name}
                      color={color}
                      size={32}
                    />
                  )}
                </div>

                {/* Bubble + meta */}
                <div style={{
                  maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3,
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                }}>
                  {/* Name + time */}
                  {!grouped && (
                    <div style={{
                      display: 'flex', gap: 6, alignItems: 'baseline',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color }}>
                        {isMe ? 'You' : (member?.name ?? 'Unknown')}
                      </span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Bubble row with action buttons */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    flexDirection: isMe ? 'row' : 'row-reverse',
                  }}>
                    {/* Action buttons */}
                    <div style={{
                      display: 'flex', gap: 4,
                      opacity: hovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}>
                      <button
                        type="button"
                        onClick={() => setEmojiFor(emojiFor === msg.id ? null : msg.id)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#fff', border: '1.5px solid #E5E7EB',
                          cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                        title="React"
                      >
                        😊
                      </button>
                      {canDelete && !msg.id.startsWith('opt-') && (
                        <button
                          type="button"
                          onClick={() => setDeleteFor(msg.id)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#fff', border: '1.5px solid #E5E7EB',
                            cursor: 'pointer', color: '#9CA3AF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                          title="Delete"
                        >
                          <TrashIcon size={13} />
                        </button>
                      )}
                    </div>

                    {/* Bubble */}
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        background: isMe ? ORANGE : '#fff',
                        color: isMe ? '#fff' : '#111827',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: '9px 14px',
                        fontSize: 14, lineHeight: 1.5,
                        boxShadow: isMe
                          ? '0 2px 10px rgba(255,107,43,0.25)'
                          : '0 1px 4px rgba(0,0,0,0.08)',
                        opacity: msg.id.startsWith('opt-') ? 0.65 : 1,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>

                      {/* Emoji picker */}
                      {emojiFor === msg.id && (
                        <EmojiPicker
                          onPick={emoji => handleReaction(msg.id, emoji)}
                          onClose={() => setEmojiFor(null)}
                          isMe={isMe}
                        />
                      )}
                    </div>
                  </div>

                  {/* Reaction pills */}
                  {Object.keys(reactionGroups).length > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 4,
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                    }}>
                      {Object.entries(reactionGroups).map(([emoji, { count, iMine }]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji as MessageEmoji)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            borderRadius: 20,
                            border: `1.5px solid ${iMine ? ORANGE : '#E5E7EB'}`,
                            background: iMine ? '#FFF3EE' : '#fff',
                            color: iMine ? ORANGE : '#6B7280',
                            padding: '2px 8px', fontSize: 12, fontWeight: 800,
                            cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                          }}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} style={{ height: 4 }} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #E5E7EB',
        background: '#fff', padding: '10px 16px 12px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          maxWidth: 640, margin: '0 auto',
        }}>
          <AvatarCircle
            avatarUrl={currentUser.avatar_url}
            name={currentUser.full_name}
            color={colorMap[currentUserId] ?? '#6366f1'}
            size={32}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the household…"
            rows={1}
            style={{
              flex: 1, resize: 'none',
              borderRadius: 20,
              border: '1.5px solid #E5E7EB',
              background: '#F7F8FA',
              padding: '9px 16px',
              fontSize: 14, color: '#111827',
              fontFamily: '"Nunito", sans-serif',
              outline: 'none',
              maxHeight: 120, overflowY: 'auto',
              lineHeight: 1.5,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = ORANGE }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: (input.trim() && !sending) ? ORANGE : '#E5E7EB',
              color: (input.trim() && !sending) ? '#fff' : '#9CA3AF',
              border: 'none',
              cursor: (input.trim() && !sending) ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s',
              boxShadow: (input.trim() && !sending) ? '0 3px 10px rgba(255,107,43,0.35)' : 'none',
            }}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {deleteFor && (
        <ConfirmDialog
          message="Delete this message?"
          onConfirm={() => handleDelete(deleteFor)}
          onCancel={() => setDeleteFor(null)}
        />
      )}

      {emojiFor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setEmojiFor(null)} />
      )}
    </>
  )
}

// ── Announcements tab ─────────────────────────────────────────────────────────

function AnnouncementsTab({
  householdId, currentUserId, isAdmin,
  initialAnnouncements, memberById, colorMap,
}: {
  householdId:          string
  currentUserId:        string
  isAdmin:              boolean
  initialAnnouncements: AnnouncementWithAuthor[]
  memberById:           Record<string, Member>
  colorMap:             Record<string, string>
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [composing,  setComposing]  = useState(false)
  const [draftText,  setDraftText]  = useState('')
  const [pinDraft,   setPinDraft]   = useState(false)
  const [saving,     startSave]     = useTransition()
  const [deleteFor,  setDeleteFor]  = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  useEffect(() => {
    const sb = supabaseRef.current
    const channel = sb
      .channel(`announcements-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', filter: `household_id=eq.${householdId}` },
        () => { window.location.reload() },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [householdId])

  async function handleCreate() {
    const text = draftText.trim()
    if (!text) return
    startSave(async () => {
      const result = await createAnnouncement(householdId, text, pinDraft)
      if (!result.error && result.announcement) {
        const newAnn: AnnouncementWithAuthor = {
          ...(result.announcement as AnnouncementWithAuthor),
          author: memberById[currentUserId] ? {
            id:         currentUserId,
            full_name:  memberById[currentUserId].name,
            avatar_url: memberById[currentUserId].avatarUrl,
            email:      '',
            created_at: '',
          } as UserRow : null,
        }
        setAnnouncements(prev =>
          [newAnn, ...prev].sort((a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        )
        setDraftText('')
        setPinDraft(false)
        setComposing(false)
      }
    })
  }

  async function handleTogglePin(id: string) {
    setTogglingId(id)
    const result = await toggleAnnouncementPin(id)
    if (!result.error) {
      setAnnouncements(prev =>
        prev
          .map(a => a.id === id ? { ...a, is_pinned: result.is_pinned! } : a)
          .sort((a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
      )
    }
    setTogglingId(null)
  }

  async function handleDelete(id: string) {
    setDeleteFor(null)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    await deleteAnnouncement(id)
  }

  const pinned   = announcements.filter(a => a.is_pinned)
  const unpinned = announcements.filter(a => !a.is_pinned)

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', minHeight: 0 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Compose (admin only) */}
          {isAdmin && (
            <div style={{
              borderRadius: 16, border: '1.5px solid #E5E7EB',
              background: '#fff', overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              {!composing ? (
                <button
                  type="button"
                  onClick={() => setComposing(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 14, color: '#9CA3AF',
                    fontFamily: '"Nunito", sans-serif',
                  }}
                >
                  <span style={{ fontSize: 22 }}>📣</span>
                  <span>Post an announcement…</span>
                </button>
              ) : (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    autoFocus
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    placeholder="Write your announcement…"
                    rows={3}
                    maxLength={1000}
                    style={{
                      width: '100%', resize: 'none', borderRadius: 12,
                      border: '1.5px solid #E5E7EB', background: '#F7F8FA',
                      padding: '10px 14px', fontSize: 14, color: '#111827',
                      fontFamily: '"Nunito", sans-serif', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    {/* Pin toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                      <div
                        onClick={() => setPinDraft(p => !p)}
                        style={{
                          position: 'relative', width: 36, height: 20,
                          borderRadius: 10, background: pinDraft ? ORANGE : '#D1D5DB',
                          cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2,
                          left: pinDraft ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'left 0.2s',
                        }} />
                      </div>
                      <span>📌 Pin to dashboard</span>
                    </label>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setComposing(false); setDraftText(''); setPinDraft(false) }}
                        style={{
                          padding: '7px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB',
                          background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B7280',
                          cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!draftText.trim() || saving}
                        style={{
                          padding: '7px 18px', borderRadius: 10, border: 'none',
                          background: draftText.trim() && !saving ? ORANGE : '#E5E7EB',
                          color: draftText.trim() && !saving ? '#fff' : '#9CA3AF',
                          fontSize: 13, fontWeight: 700, cursor: draftText.trim() && !saving ? 'pointer' : 'default',
                          fontFamily: '"Nunito", sans-serif',
                        }}
                      >
                        {saving ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pinned */}
          {pinned.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                📌 Pinned
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pinned.map(a => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    isAdmin={isAdmin}
                    toggling={togglingId === a.id}
                    onTogglePin={() => handleTogglePin(a.id)}
                    onDelete={() => setDeleteFor(a.id)}
                    colorMap={colorMap}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All */}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  All
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unpinned.map(a => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    isAdmin={isAdmin}
                    toggling={togglingId === a.id}
                    onTogglePin={() => handleTogglePin(a.id)}
                    onDelete={() => setDeleteFor(a.id)}
                    colorMap={colorMap}
                  />
                ))}
              </div>
            </div>
          )}

          {announcements.length === 0 && !composing && (
            <div style={{
              borderRadius: 20, border: '2px dashed #E5E7EB',
              background: '#fff', padding: '48px 28px 40px',
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#FFF3EE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                📌
              </div>
              <p style={{ marginTop: 16, fontWeight: 800, color: '#111827', fontSize: 16, margin: '16px 0 0', fontFamily: '"Poppins", sans-serif' }}>
                No announcements yet
              </p>
              <p style={{ marginTop: 6, fontSize: 13, color: '#9CA3AF', lineHeight: 1.5, maxWidth: 240, margin: '8px auto 0' }}>
                {isAdmin
                  ? 'Post important updates to keep the household informed.'
                  : 'Admins can post important updates here for the household.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setComposing(true)}
                  style={{
                    marginTop: 20,
                    padding: '11px 28px', borderRadius: 12, border: 'none',
                    background: ORANGE, color: '#fff',
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    fontFamily: '"Nunito", sans-serif',
                    boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
                  }}
                >
                  📣 Post Announcement
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {deleteFor && (
        <ConfirmDialog
          message="Delete this announcement?"
          onConfirm={() => handleDelete(deleteFor)}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </div>
  )
}

// ── Announcement card ─────────────────────────────────────────────────────────

function AnnouncementCard({
  announcement, isAdmin, toggling, onTogglePin, onDelete, colorMap,
}: {
  announcement: AnnouncementWithAuthor
  isAdmin:      boolean
  toggling:     boolean
  onTogglePin:  () => void
  onDelete:     () => void
  colorMap:     Record<string, string>
}) {
  const color    = colorMap[announcement.created_by] ?? '#6366f1'
  const isPinned = announcement.is_pinned

  return (
    <div style={{
      borderRadius: 16,
      border: `1.5px solid ${isPinned ? '#FFD5C2' : '#E5E7EB'}`,
      background: isPinned ? '#FFFAF7' : '#fff',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {isPinned && (
        <div style={{
          background: ORANGE, padding: '6px 16px',
          fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.03em',
        }}>
          📌 Pinned announcement
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#111827', whiteSpace: 'pre-wrap' }}>
          {announcement.content}
        </p>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff',
            }}>
              {initials(announcement.author?.full_name ?? null)}
            </div>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {announcement.author?.full_name ?? 'Admin'} · {formatTime(announcement.created_at)}
            </span>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={onTogglePin}
                disabled={toggling}
                style={{
                  padding: '4px 10px', borderRadius: 8, border: 'none',
                  background: isPinned ? '#FFF3EE' : '#F3F4F6',
                  color: isPinned ? ORANGE : '#6B7280',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: '"Nunito", sans-serif',
                  opacity: toggling ? 0.5 : 1,
                }}
              >
                {isPinned ? 'Unpin' : '📌 Pin'}
              </button>
              <button
                type="button"
                onClick={onDelete}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: 'none', background: 'none',
                  color: '#9CA3AF', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmojiPicker({ onPick, onClose, isMe }: {
  onPick:  (e: MessageEmoji) => void
  onClose: () => void
  isMe:    boolean
}) {
  return (
    <div style={{
      position: 'absolute', zIndex: 20,
      display: 'flex', gap: 4,
      borderRadius: 20, border: '1.5px solid #E5E7EB',
      background: '#fff', padding: '6px 8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      top: -44,
      ...(isMe ? { right: 0 } : { left: 0 }),
    }}>
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          style={{
            width: 36, height: 36, borderRadius: 12,
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.1s',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)' }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message:   string
  onConfirm: () => void
  onCancel:  () => void
}) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel}
      />
      <div style={{
        position: 'fixed', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 50, width: 320,
        background: '#fff', borderRadius: 20,
        padding: '24px 20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>{message}</p>
        <p style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              border: '1.5px solid #E5E7EB', background: '#fff',
              fontSize: 14, fontWeight: 700, color: '#374151', cursor: 'pointer',
              fontFamily: '"Nunito", sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              border: 'none', background: '#EF4444',
              fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
              fontFamily: '"Nunito", sans-serif',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  )
}

function TabBtn({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0', border: 'none',
        background: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 800,
        fontFamily: '"Nunito", sans-serif',
        color: active ? ORANGE : '#9CA3AF',
        borderBottom: `2.5px solid ${active ? ORANGE : 'transparent'}`,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  )
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
