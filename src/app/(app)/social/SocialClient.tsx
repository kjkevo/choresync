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
import type {
  UserRow, MessageWithMeta, MessageReactionRow,
  AnnouncementWithAuthor, MessageEmoji,
} from '@/lib/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJIS: MessageEmoji[] = ['👍', '❤️', '😂', '😮', '🎉', '🔥']

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home'    },
  { href: '/chores',    label: 'Chores'  },
  { href: '/calendar',  label: '📅'      },
  { href: '/social',    label: '💬', active: true },
  { href: '/history',   label: '📊'      },
  { href: '/rewards',   label: '🏆'      },
  { href: '/household', label: 'House'   },
  { href: '/settings',  label: '⚙️'      },
  { href: '/profile',   label: 'Profile' },
]

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

  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) {
    return `Yesterday ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isGrouped(msgs: MessageWithMeta[], idx: number) {
  if (idx === 0) return false
  const prev = msgs[idx - 1]
  const curr = msgs[idx]
  if (prev.user_id !== curr.user_id) return false
  return new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
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
  announcements:  initialAnnouncements,
  members,
  colorMap,
}: SocialClientProps) {
  const [tab, setTab] = useState<'chat' | 'announcements'>('chat')

  const memberById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  )

  return (
    <div className="flex h-dvh flex-col" style={{ background: 'var(--cs-bg)' }}>
      {/* Nav */}
      <header className="flex-shrink-0 app-header">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>{householdName}</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, active }) => (
              <a key={href} href={href} className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Tab strip */}
        <div className="mx-auto flex max-w-2xl border-t border-slate-100">
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
            💬 Chat
          </TabButton>
          <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')}>
            📌 Announcements
          </TabButton>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
    </div>
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
  const [messages, setMessages]   = useState<MessageWithMeta[]>(initialMessages)
  const [input,    setInput]      = useState('')
  const [sending,  startSend]     = useTransition()
  const [emojiFor, setEmojiFor]   = useState<string | null>(null)   // message id showing picker
  const [deleteFor, setDeleteFor] = useState<string | null>(null)   // message id awaiting confirm
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const supabase  = useRef(createClient())

  // Scroll to bottom
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
          // Skip if we already have this message (optimistic insert)
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            const member = memberById[newMsg.user_id] ?? null
            // Cast member to UserRow | null — real-time payloads only have
            // the subset of fields we need; the author type is widened here.
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

  // Send message
  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    // Optimistic insert
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
        // Revert optimistic
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      } else if (result.message) {
        // Replace optimistic with real row
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

  // Toggle emoji reaction (optimistic)
  async function handleReaction(messageId: string, emoji: MessageEmoji) {
    setEmojiFor(null)
    const alreadyReacted = messages
      .find(m => m.id === messageId)
      ?.reactions.some(r => r.user_id === currentUserId && r.emoji === emoji)

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      if (alreadyReacted) {
        return { ...m, reactions: m.reactions.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)) }
      } else {
        const fake: MessageReactionRow = {
          id: `opt-${Date.now()}`, message_id: messageId,
          user_id: currentUserId, emoji, created_at: new Date().toISOString(),
        }
        return { ...m, reactions: [...m.reactions, fake] }
      }
    }))

    await toggleReaction(messageId, emoji)
  }

  // Delete message
  async function handleDelete(messageId: string) {
    setDeleteFor(null)
    setMessages(prev => prev.filter(m => m.id !== messageId))
    await deleteMessage(messageId)
  }

  return (
    <>
      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-3 font-semibold text-slate-600">No messages yet</p>
            <p className="mt-1 text-sm text-slate-400">Be the first to say hello!</p>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-1">
          {messages.map((msg, idx) => {
            const grouped  = isGrouped(messages, idx)
            const isMe     = msg.user_id === currentUserId
            const color    = colorMap[msg.user_id] ?? '#6366f1'
            const member   = memberById[msg.user_id]
            const canDelete = isMe || isAdmin

            // Group reactions by emoji
            const reactionGroups: Record<string, { count: number; iMine: boolean }> = {}
            for (const r of msg.reactions) {
              if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, iMine: false }
              reactionGroups[r.emoji].count++
              if (r.user_id === currentUserId) reactionGroups[r.emoji].iMine = true
            }

            return (
              <div
                key={msg.id}
                className={`group flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${grouped ? 'mt-0.5' : 'mt-4'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 ${grouped ? 'w-8 opacity-0' : 'w-8'}`}>
                  {!grouped && (
                    <div
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      {member?.avatarUrl ? (
                        <Image src={member.avatarUrl} alt={member.name ?? ''} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        initials(member?.name ?? null)
                      )}
                    </div>
                  )}
                </div>

                {/* Bubble + meta */}
                <div className={`flex max-w-[75%] flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!grouped && (
                    <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-xs font-semibold" style={{ color }}>
                        {isMe ? 'You' : (member?.name ?? 'Unknown')}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                    </div>
                  )}

                  <div className="relative">
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm
                        ${isMe
                          ? 'rounded-tr-sm text-white'
                          : 'rounded-tl-sm bg-white text-slate-800 border border-slate-100'
                        }
                        ${msg.id.startsWith('opt-') ? 'opacity-70' : ''}
                      `}
                      style={isMe ? { background: color } : undefined}
                    >
                      {msg.content}
                    </div>

                    {/* Action buttons (visible on group-hover) */}
                    <div className={`absolute top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity
                      ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setEmojiFor(emojiFor === msg.id ? null : msg.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 text-sm shadow-sm hover:bg-slate-50"
                        title="React"
                      >
                        😊
                      </button>
                      {canDelete && !msg.id.startsWith('opt-') && (
                        <button
                          type="button"
                          onClick={() => setDeleteFor(msg.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-red-50 hover:border-red-200"
                          title="Delete"
                        >
                          <TrashIcon className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>

                    {/* Emoji picker popover */}
                    {emojiFor === msg.id && (
                      <EmojiPicker
                        onPick={(emoji) => handleReaction(msg.id, emoji)}
                        onClose={() => setEmojiFor(null)}
                        isMe={isMe}
                      />
                    )}
                  </div>

                  {/* Reaction pills */}
                  {Object.keys(reactionGroups).length > 0 && (
                    <div className={`flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reactionGroups).map(([emoji, { count, iMine }]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji as MessageEmoji)}
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition
                            ${iMine
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
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
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
            style={{ background: colorMap[currentUserId] ?? '#6366f1' }}
          >
            {currentUser.avatar_url ? (
              <Image src={currentUser.avatar_url} alt={currentUser.full_name ?? ''} width={32} height={32} className="h-full w-full object-cover" unoptimized />
            ) : (
              initials(currentUser.full_name)
            )}
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the household…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-40 active:scale-95"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Delete confirm dialog */}
      {deleteFor && (
        <ConfirmDialog
          message="Delete this message?"
          onConfirm={() => handleDelete(deleteFor)}
          onCancel={() => setDeleteFor(null)}
        />
      )}

      {/* Close emoji picker on outside click */}
      {emojiFor && (
        <div className="fixed inset-0 z-10" onClick={() => setEmojiFor(null)} />
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

  // Real-time announcements
  const supabaseRef = useRef(createClient())
  useEffect(() => {
    const sb = supabaseRef.current
    const channel = sb
      .channel(`announcements-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', filter: `household_id=eq.${householdId}` },
        () => {
          // Full refresh on any announcement change (they're infrequent)
          window.location.reload()
        },
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
        setAnnouncements(prev => [newAnn, ...prev].sort((a, b) =>
          (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))
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
        prev.map(a => a.id === id ? { ...a, is_pinned: result.is_pinned! } : a)
            .sort((a, b) =>
              (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* Compose (admin only) */}
          {isAdmin && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {!composing ? (
                <button
                  type="button"
                  onClick={() => setComposing(true)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-slate-400 hover:bg-slate-50 transition"
                >
                  <span className="text-xl">📣</span>
                  <span>Post an announcement…</span>
                </button>
              ) : (
                <div className="p-4 space-y-3">
                  <textarea
                    autoFocus
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    placeholder="Write your announcement…"
                    rows={3}
                    maxLength={1000}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                      <div
                        onClick={() => setPinDraft(p => !p)}
                        className={`relative h-5 w-9 cursor-pointer rounded-full transition ${pinDraft ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${pinDraft ? 'left-4' : 'left-0.5'}`} />
                      </div>
                      <span className="flex items-center gap-1">
                        <span>📌</span> Pin to dashboard
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setComposing(false); setDraftText(''); setPinDraft(false) }}
                        className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!draftText.trim() || saving}
                        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                      >
                        {saving ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pinned section */}
          {pinned.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">📌 Pinned</p>
              <div className="space-y-3">
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

          {/* All announcements */}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">All</p>
              )}
              <div className="space-y-3">
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
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
              <p className="text-3xl">📌</p>
              <p className="mt-3 font-semibold text-slate-600">No announcements yet</p>
              {isAdmin && (
                <p className="mt-1 text-sm text-slate-400">
                  Post important messages above to keep the household informed.
                </p>
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
  const color     = colorMap[announcement.created_by] ?? '#6366f1'
  const isPinned  = announcement.is_pinned

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm
      ${isPinned ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'}`}>
      {isPinned && (
        <div className="bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white">
          📌 Pinned announcement
        </div>
      )}
      <div className="p-4">
        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{announcement.content}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: color }}
            >
              {initials(announcement.author?.full_name ?? null)}
            </div>
            <span className="text-xs text-slate-400">
              {announcement.author?.full_name ?? 'Admin'} · {formatTime(announcement.created_at)}
            </span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onTogglePin}
                disabled={toggling}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50
                  ${isPinned
                    ? 'text-indigo-600 hover:bg-indigo-50'
                    : 'text-slate-500 hover:bg-slate-100'
                  }`}
                title={isPinned ? 'Unpin' : 'Pin to dashboard'}
              >
                {isPinned ? 'Unpin' : '📌 Pin'}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                title="Delete"
              >
                <TrashIcon className="h-3.5 w-3.5" />
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
    <div className={`absolute z-20 flex gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl
      top-0 ${isMe ? 'right-full mr-10' : 'left-full ml-10'}`}>
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-lg hover:bg-slate-100 transition active:scale-90"
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
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-80 sm:-translate-x-1/2">
        <p className="font-semibold text-slate-900">{message}</p>
        <p className="mt-1 text-sm text-slate-500">This action cannot be undone.</p>
        <div className="mt-4 flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition">
            Delete
          </button>
        </div>
      </div>
    </>
  )
}

function TabButton({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-semibold transition border-b-2
        ${active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
      {children}
    </button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
