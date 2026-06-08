'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { completeChore } from '@/lib/actions/chores'
import { addCompletionReaction, removeCompletionReaction } from '@/lib/actions/reactions'
import CompleteChoreSheet from '@/components/chores/CompleteChoreSheet'
import { CATEGORY_META } from '@/components/chores/ChoreModal'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import BottomNav from '@/components/ui/BottomNav'
import type { ChoreWithAssignee, UserRow } from '@/lib/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HouseholdChoreRow {
  id:           string
  name:         string
  status:       'incomplete' | 'complete'
  assigned_to:  string | null
  assigneeName: string | null
  points:       number
  category:     string
}

export interface ReactionEntry {
  emoji:  string
  userId: string
}

export interface ActivityEntry {
  id:          string
  choreName:   string
  category:    string
  completedAt: string
  points:      number
  wasOnTime:   boolean | null
  reactions:   ReactionEntry[]
  member: {
    id:       string
    name:     string | null
    avatarUrl:string | null
    color:    string
  } | null
}

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎉', '💪', '😂'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingKey(): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const h = new Date().getHours()
  return h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening'
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDue(iso: string) {
  const today = new Date().toISOString().split('T')[0]
  if (iso === today) return 'Today'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HouseholdSummary {
  id:   string
  name: string
}

export interface LeaderboardEntry {
  userId:        string
  name:          string | null
  avatarUrl:     string | null
  color:         string
  totalPoints:   number
  currentStreak: number
}

interface MemberSummary {
  id:        string
  name:      string | null
  avatarUrl: string | null
  color:     string
}

// Used for sessionStorage preview data (unauthenticated walkthrough)
interface PreviewMember {
  id?:       string
  name:      string | null
  avatarUrl: string | null
  color:     string
  isMe?:     boolean
}
interface PreviewChore {
  name:            string
  emoji:           string
  points:          number
  freq:            string
  displayAssignTo: string   // pre-resolved name (no 'me' / 'unassigned' — always a display name)
}

interface DashboardClientProps {
  currentUser:         UserRow
  myOverdueChores:     ChoreWithAssignee[]
  myTodayChores:       ChoreWithAssignee[]
  householdName:       string
  householdId:         string
  colorMap:            Record<string, string>
  myStreak:            { current_streak: number; total_completions: number } | null
  pinnedAnnouncements: { id: string; content: string; author: UserRow | null }[]
  recentActivity:      ActivityEntry[]
  allHouseholds?:      HouseholdSummary[]
  householdAllChores?: HouseholdChoreRow[]
  leaderboard?:        LeaderboardEntry[]
  members?:            MemberSummary[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  currentUser,
  myOverdueChores:    initialOverdue,
  myTodayChores:      initialToday,
  householdName,
  householdId,
  colorMap,
  myStreak,
  pinnedAnnouncements,
  recentActivity:     initialActivity,
  allHouseholds = [],
  householdAllChores = [],
  leaderboard = [],
  members = [],
}: DashboardClientProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [overdueChores,  setOverdueChores]  = useState(initialOverdue)
  const [todayChores,    setTodayChores]    = useState(initialToday)
  const [recentActivity, setRecentActivity] = useState(initialActivity)
  const [completeSheet,  setCompleteSheet]  = useState<ChoreWithAssignee | null>(null)
  const [quickPending,   setQuickPending]   = useState<Set<string>>(new Set())
  const [dismissedPins,  setDismissedPins]  = useState<Set<string>>(new Set())
  const [switcherOpen,   setSwitcherOpen]   = useState(false)
  const [, startTransition]                 = useTransition()

  // Guest-mode avatar (data URL) — used in the header circle when there's
  // no real session. Set in /profile via the photo upload modal.
  const [guestAvatarUrl, setGuestAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    if (currentUser.id) return
    try {
      const cached = localStorage.getItem('cs_guest_avatar')
      if (cached) setGuestAvatarUrl(cached)
    } catch { /* ignore */ }
  }, [currentUser.id])

  // ── Preview onboarding data (sessionStorage, for unauthenticated walkthroughs) ──
  const [previewHouseholdName, setPreviewHouseholdName] = useState('')
  const [previewAdminName,     setPreviewAdminName]     = useState('')
  const [previewMembers,       setPreviewMembers]       = useState<PreviewMember[]>([])
  const [previewChores,        setPreviewChores]        = useState<PreviewChore[]>([])
  const [previewRotationType,  setPreviewRotationType]  = useState<string>('')
  const [previewRotationOrder, setPreviewRotationOrder] = useState<string[]>([])

  useEffect(() => {
    if (householdId) return  // real household — don't override
    try {
      const raw = sessionStorage.getItem('cs_preview_onboarding')
      if (!raw) return
      const data = JSON.parse(raw) as {
        name: string
        adminName?: string
        members: PreviewMember[]
        chores: PreviewChore[]
        rotationType?: string
        rotationOrder?: string[]
      }
      setPreviewHouseholdName(data.name ?? '')
      setPreviewAdminName(data.adminName ?? '')
      setPreviewMembers(data.members ?? [])
      setPreviewChores(data.chores ?? [])
      setPreviewRotationType(data.rotationType ?? '')
      setPreviewRotationOrder(data.rotationOrder ?? [])
    } catch { /* ignore */ }
  }, [householdId])

  // Map rotation type ID → display label + emoji
  const rotationMeta = previewRotationType === 'admin-approval'
    ? { emoji: '👑', label: "Admin's Word",         desc: 'Admin approves photos; admin sets the order' }
    : previewRotationType === 'ai-detection'
      ? { emoji: '🤖', label: 'AI Completion Detection', desc: 'AI verifies completion photos' }
      : previewRotationType === 'manual-completion'
        ? { emoji: '✅', label: 'Manual Completion', desc: 'Auto-advances to the next person' }
        : null

  // Aggregate stats from preview chores
  const choresByFreq = previewChores.reduce<Record<string, number>>((acc, c) => {
    acc[c.freq] = (acc[c.freq] ?? 0) + 1
    return acc
  }, {})
  const totalPoints = previewChores.reduce((s, c) => s + c.points, 0)

  // Manual-Completion handler — advance the chore to the next person in
  // the rotation, then persist to sessionStorage so the change survives
  // page reloads and other tabs (chat, profile) see the same state.
  const completePreviewChore = useCallback((choreIdx: number) => {
    setPreviewChores(prev => {
      const updated = prev.slice()
      const chore   = updated[choreIdx]
      if (!chore) return prev

      // Resolve the rotation order (admin first then roommates, in member order)
      const order = previewMembers.map(m => m.name ?? '').filter(Boolean)
      if (order.length === 0) return prev

      const currentIdx = order.indexOf(chore.displayAssignTo)
      const nextIdx    = currentIdx === -1 ? 0 : (currentIdx + 1) % order.length
      updated[choreIdx] = { ...chore, displayAssignTo: order[nextIdx] }

      // Persist
      try {
        const raw = sessionStorage.getItem('cs_preview_onboarding')
        if (raw) {
          const data = JSON.parse(raw) as { chores?: PreviewChore[] }
          data.chores = updated
          sessionStorage.setItem('cs_preview_onboarding', JSON.stringify(data))
        }
      } catch { /* ignore */ }

      return updated
    })
  }, [previewMembers])

  const visiblePins  = pinnedAnnouncements.filter(a => !dismissedPins.has(a.id))
  const totalPending = overdueChores.length + todayChores.length

  const removeFromLists = useCallback((choreId: string) => {
    setOverdueChores(p => p.filter(c => c.id !== choreId))
    setTodayChores(p   => p.filter(c => c.id !== choreId))
  }, [])

  function handleQuickComplete(chore: ChoreWithAssignee) {
    setQuickPending(prev => new Set(prev).add(chore.id))
    startTransition(async () => {
      const result = await completeChore(chore.id)
      if (!result?.error) { removeFromLists(chore.id); router.refresh() }
      setQuickPending(prev => { const s = new Set(prev); s.delete(chore.id); return s })
    })
  }

  function handleSheetDone(choreId: string) {
    removeFromLists(choreId)
    router.refresh()
  }

  function handleReactionToggle(completionId: string, emoji: string, alreadyReacted: boolean) {
    // Optimistic update
    setRecentActivity(prev => prev.map(item => {
      if (item.id !== completionId) return item
      if (alreadyReacted) {
        return { ...item, reactions: item.reactions.filter(r => !(r.emoji === emoji && r.userId === currentUser.id)) }
      } else {
        return { ...item, reactions: [...item.reactions, { emoji, userId: currentUser.id }] }
      }
    }))
    // Server call (fire and forget — optimistic state is the truth)
    startTransition(async () => {
      if (alreadyReacted) {
        await removeCompletionReaction(completionId, emoji)
      } else {
        await addCompletionReaction(completionId, emoji, householdId)
      }
    })
  }

  return (
    <>
      <style>{FONTS}</style>

      <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: '"Nunito", sans-serif' }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#fff', borderBottom: '1px solid #F0F0F0',
          padding: '0 20px', height: 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: '#FFD166',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>🧹</div>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 18, color: '#111827', letterSpacing: '-0.3px' }}>
              ChoreSync
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <button
              type="button"
              aria-label={allHouseholds.length > 1 ? 'Switch household' : householdName}
              onClick={() => allHouseholds.length > 1 && setSwitcherOpen(o => !o)}
              style={{
                fontSize: 12, fontWeight: 700, color: '#6B7280',
                background: '#F3F4F6', borderRadius: 99, padding: '4px 10px',
                border: 'none', cursor: allHouseholds.length > 1 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {previewHouseholdName || householdName}
              {allHouseholds.length > 1 && (
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>▾</span>
              )}
            </button>

            {/* Household switcher dropdown */}
            {switcherOpen && allHouseholds.length > 1 && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setSwitcherOpen(false)}
                />
                <div style={{
                  position: 'absolute', top: 36, right: 0, zIndex: 50,
                  background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  border: '1px solid #F0F0F0', minWidth: 200, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Switch Household
                  </div>
                  {allHouseholds.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => { setSwitcherOpen(false); router.push(`/dashboard?h=${h.id}`) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', fontSize: 14, fontWeight: h.name === householdName ? 700 : 500,
                        color: h.name === householdName ? '#FF6B2B' : '#374151',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderLeft: h.name === householdName ? '3px solid #FF6B2B' : '3px solid transparent',
                      }}
                    >
                      {h.name}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid #F3F4F6', padding: '8px 10px', display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => { setSwitcherOpen(false); router.push('/onboarding?action=join') }}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', border: 'none', borderRadius: 99, cursor: 'pointer' }}
                    >
                      + Join
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSwitcherOpen(false); router.push('/onboarding?action=create') }}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, color: '#fff', background: '#FF6B2B', border: 'none', borderRadius: 99, cursor: 'pointer' }}
                    >
                      + Create
                    </button>
                  </div>
                </div>
              </>
            )}

            <AvatarCircle
              user={
                // Hydrate guest avatar from localStorage so the header circle
                // shows the photo the user just uploaded in /profile
                currentUser.id || !guestAvatarUrl
                  ? currentUser
                  : { ...currentUser, avatar_url: guestAvatarUrl }
              }
              color={colorMap[currentUser.id]}
              size={32}
            />
          </div>
        </header>

        {/* ── Scrollable content ────────────────────────────────────────────── */}
        <main style={{ maxWidth: 500, margin: '0 auto', padding: '20px 16px 0' }}>

          {/* Greeting */}
          <section style={{ marginBottom: 22 }}>
            <h1 style={{
              fontFamily: '"Poppins", sans-serif', fontWeight: 800,
              fontSize: 25, color: '#111827', margin: 0, letterSpacing: '-0.4px',
            }}>
              {t(greetingKey())}, {
                (currentUser.full_name && currentUser.full_name !== 'Guest'
                  ? currentUser.full_name
                  : previewAdminName || 'there'
                ).split(' ')[0]
              } 👋
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>
                {totalPending === 0
                  ? "You're all caught up 🎉"
                  : `${totalPending} chore${totalPending !== 1 ? 's' : ''} need${totalPending === 1 ? 's' : ''} your attention`}
              </p>
              {myStreak && myStreak.current_streak >= 2 && (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#EA580C',
                  background: '#FFF7ED', borderRadius: 99, padding: '3px 10px',
                  border: '1px solid #FED7AA',
                }}>
                  🔥 {myStreak.current_streak}-day streak
                </span>
              )}
            </div>
          </section>

          {/* Pinned announcements */}
          {visiblePins.length > 0 && (
            <section style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visiblePins.map(ann => (
                <div key={ann.id} style={{
                  background: '#EEF2FF', border: '1px solid #C7D2FE',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>📌</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Pinned · {ann.author?.full_name ?? 'Admin'}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.55 }}>{ann.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedPins(prev => new Set(prev).add(ann.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A5B4FC', padding: 2, flexShrink: 0, display: 'flex' }}
                    aria-label="Dismiss"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* ── Overdue ──────────────────────────────────────────────────────── */}
          {overdueChores.length > 0 && (
            <section style={{ marginBottom: 16 }}>
              <SectionTitle icon="⚠️" label={t('overdue')} count={overdueChores.length} color="#EF4444" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overdueChores.map(chore => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    variant="overdue"
                    pending={quickPending.has(chore.id)}
                    onQuickComplete={() => handleQuickComplete(chore)}
                    onDone={() => setCompleteSheet(chore)}
                    markDoneLabel={t('markDone')}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Members (moved above chores) ─────────────────────────────────── */}
          {(members.length > 0 || previewMembers.length > 0) && (
            <section style={{ marginBottom: 20 }}>
              <SectionTitle icon="👥" label="Members" color="#374151" />
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                {(members.length > 0 ? members : previewMembers).map((m, idx) => {
                  const isMe = members.length > 0 ? m.id === currentUser.id : (m as PreviewMember).isMe
                  const isEmoji = m.avatarUrl?.startsWith('emoji:')
                  return (
                    <div key={m.id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: m.color, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isEmoji ? 22 : 14, fontWeight: 700, color: '#fff',
                        border: isMe ? '2.5px solid #FF6B2B' : '2.5px solid transparent',
                      }}>
                        {isEmoji
                          ? m.avatarUrl!.slice(6)
                          : m.avatarUrl
                            ? <Image src={m.avatarUrl} alt={m.name ?? ''} width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                            : initials(m.name)
                        }
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isMe ? '#FF6B2B' : '#6B7280', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {isMe ? 'You' : (m.name?.split(' ')[0] ?? '?')}
                      </span>
                    </div>
                  )
                })}
                <a href="/household" style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: '#F3F4F6', border: '2px dashed #D1D5DB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, textDecoration: 'none', color: '#9CA3AF', flexShrink: 0,
                }} title="Manage household">+</a>
              </div>
            </section>
          )}

          {/* ── Chores by person ─────────────────────────────────────────────── */}
          {(() => {
            const isPreview = householdAllChores.length === 0 && previewChores.length > 0

            // ── preview path ─────────────────────────────────────────────────
            if (isPreview) {
              // Group by pre-resolved displayAssignTo name.
              // Preserve member order: admin (isMe) first, then roommates in order.
              const memberOrder = previewMembers.map(m => m.name ?? '').filter(Boolean)
              const myName      = previewMembers.find(m => m.isMe)?.name ?? ''
              // Default to manual-completion semantics when rotationType is
              // empty (e.g. sessionStorage was set before rotationType was
              // being saved, or user never went through full onboarding).
              const canComplete = previewRotationType === '' || previewRotationType === 'manual-completion'

              const renderPreviewGroup = (
                label: string,
                chores: { c: PreviewChore; idx: number }[],
                accent: string,
                isYou: boolean,
              ) => chores.length === 0 ? null : (
                <div style={{ marginBottom: 12 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: accent,
                    margin: '0 0 6px', paddingLeft: 2,
                  }}>
                    {isYou ? '👤 ' : ''}{label}
                  </p>
                  <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${isYou ? '#FFD5C2' : '#F0F0F0'}`, overflow: 'hidden' }}>
                    {chores.map(({ c: chore, idx }, i) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        borderBottom: i < chores.length - 1 ? '1px solid #F7F8FA' : 'none',
                        background: isYou ? '#FFFAF8' : '#fff',
                      }}>
                        <span style={{ fontSize: 19, flexShrink: 0 }}>{chore.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: 13, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chore.name}
                          </p>
                          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0', textTransform: 'capitalize' }}>
                            {chore.freq}
                          </p>
                        </div>
                        {chore.points > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FFFBEB', borderRadius: 99, padding: '2px 7px', flexShrink: 0 }}>
                            {chore.points} pts
                          </span>
                        )}
                        {/* Complete button — only on YOUR chores */}
                        {canComplete && isYou && (
                          <button
                            type="button"
                            onClick={() => completePreviewChore(idx)}
                            style={{
                              flexShrink: 0,
                              background: '#10B981', color: '#fff',
                              border: 'none', borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 11, fontWeight: 800,
                              cursor: 'pointer',
                              fontFamily: '"Nunito", sans-serif',
                              display: 'flex', alignItems: 'center', gap: 4,
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            }}
                            aria-label={`Mark ${chore.name} complete`}
                          >
                            ✓ Done
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )

              return (
                <section style={{ marginBottom: 20 }}>
                  <SectionTitle icon="📋" label="Chores" color="#374151" />
                  {canComplete && myName && (
                    <p style={{
                      fontSize: 11, color: '#9CA3AF', margin: '0 0 10px', paddingLeft: 2,
                      lineHeight: 1.5,
                    }}>
                      Tap <span style={{ background: '#10B981', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>✓ Done</span> on a chore to pass it to the next person.
                    </p>
                  )}
                  {memberOrder.map(memberName => {
                    const m       = previewMembers.find(pm => (pm.name ?? '') === memberName)
                    const isYou   = !!(m as PreviewMember | undefined)?.isMe
                    const section = previewChores
                      .map((c, idx) => ({ c, idx }))
                      .filter(({ c }) => c.displayAssignTo === memberName)
                    const label   = isYou ? 'Your chores' : `${memberName}'s chores`
                    return renderPreviewGroup(label, section, isYou ? '#FF6B2B' : '#6B7280', isYou)
                  })}
                </section>
              )
            }

            // ── real DB path ─────────────────────────────────────────────────
            if (householdAllChores.length === 0) return (
              <section style={{ marginBottom: 20 }}>
                <SectionTitle icon="📋" label="Chores" color="#374151" />
                <div style={{
                  background: '#fff', borderRadius: 16, border: '1.5px dashed #E5E7EB',
                  padding: '24px 20px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 14px' }}>
                    No chores set up yet.
                  </p>
                  <a href="/onboarding" style={{
                    display: 'inline-block',
                    background: '#FF6B2B', color: '#fff',
                    borderRadius: 12, padding: '10px 22px',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 13,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
                  }}>
                    ✨ Add your first chore
                  </a>
                </div>
              </section>
            )

            const myRealChores    = householdAllChores.filter(c => c.assigned_to === currentUser.id)
            const othersChores    = householdAllChores.filter(c => c.assigned_to && c.assigned_to !== currentUser.id)
            const unassignedReal  = householdAllChores.filter(c => !c.assigned_to)
            const roommateNames   = [...new Set(othersChores.map(c => c.assigneeName).filter(Boolean))] as string[]

            const renderRealGroup = (
              label: string,
              chores: typeof householdAllChores,
              accent: string,
              isYou: boolean,
            ) => chores.length === 0 ? null : (
              <div style={{ marginBottom: 12 }}>
                <p style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: accent,
                  margin: '0 0 6px', paddingLeft: 2,
                }}>
                  {isYou ? '👤 ' : ''}{label}
                </p>
                <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${isYou ? '#FFD5C2' : '#F0F0F0'}`, overflow: 'hidden' }}>
                  {chores.map((chore, i) => {
                    const catMeta = (CATEGORY_META as Record<string, { emoji: string }>)[chore.category] ?? { emoji: '🏠' }
                    const isDone  = chore.status === 'complete'
                    return (
                      <div key={chore.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        borderBottom: i < chores.length - 1 ? '1px solid #F7F8FA' : 'none',
                        background: isYou ? '#FFFAF8' : '#fff',
                        opacity: isDone ? 0.55 : 1,
                      }}>
                        <span style={{ fontSize: 19, flexShrink: 0 }}>{catMeta.emoji}</span>
                        <p style={{
                          fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: 13,
                          color: '#111827', margin: 0, flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}>
                          {chore.name}
                        </p>
                        {chore.points > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FFFBEB', borderRadius: 99, padding: '2px 7px', flexShrink: 0 }}>
                            {chore.points} pts
                          </span>
                        )}
                        <span style={{
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                          borderRadius: 99, padding: '3px 9px',
                          background: isDone ? '#D1FAE5' : '#F3F4F6',
                          color: isDone ? '#059669' : '#6B7280',
                        }}>
                          {isDone ? '✓' : 'Pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )

            return (
              <section style={{ marginBottom: 20 }}>
                <SectionTitle icon="📋" label="Chores" color="#374151" />
                {renderRealGroup('Your chores', myRealChores, '#FF6B2B', true)}
                {roommateNames.map(name => renderRealGroup(
                  `${name}'s chores`,
                  othersChores.filter(c => c.assigneeName === name),
                  '#6B7280', false,
                ))}
                {renderRealGroup('Unassigned', unassignedReal, '#9CA3AF', false)}
              </section>
            )
          })()}


          {/* ── Chat CTA (when no activity yet) ──────────────────────────────── */}
          {todayChores.length === 0 && overdueChores.length === 0 && recentActivity.length === 0 && (
            <a href="/social" style={{
              display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
              background: 'linear-gradient(135deg, #FF6B2B 0%, #ff9a5c 100%)',
              borderRadius: 20, padding: '22px 20px', marginBottom: 16,
            }}>
              <span style={{ fontSize: 36, flexShrink: 0 }}>💬</span>
              <div>
                <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 16, color: '#fff', margin: '0 0 4px' }}>
                  Say hi in the household chat
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                  Be the first to post in {householdName}
                </p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 20, flexShrink: 0 }}>→</span>
            </a>
          )}

          {/* ── Activity feed ─────────────────────────────────────────────────── */}
          {recentActivity.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <SectionTitle icon="📡" label="Recent Activity" color="#6B7280" />
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                {recentActivity.map((item, i) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    isLast={i === recentActivity.length - 1}
                    isMe={item.member?.id === currentUser.id}
                    currentUserId={currentUser.id}
                    onReactionToggle={handleReactionToggle}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Leaderboard — always at the bottom ───────────────────────────── */}
          {(() => {
            const medals = ['🥇', '🥈', '🥉']

            // Real leaderboard row
            const RealRow = ({ entry, i, total }: { entry: typeof leaderboard[0]; i: number; total: number }) => {
              const isMe    = entry.userId === currentUser.id
              const isEmoji = entry.avatarUrl?.startsWith('emoji:')
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < total - 1 ? '1px solid #F7F8FA' : 'none',
                  background: isMe ? '#FFF9F7' : 'transparent',
                  borderLeft: isMe ? '3px solid #FF6B2B' : '3px solid transparent',
                }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>
                    {medals[i] ?? <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF' }}>#{i + 1}</span>}
                  </span>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: entry.color, flexShrink: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isEmoji ? 17 : 12, fontWeight: 700, color: '#fff',
                  }}>
                    {isEmoji ? entry.avatarUrl!.slice(6) : (entry.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: isMe ? 800 : 600, color: isMe ? '#FF6B2B' : '#111827', fontFamily: '"Poppins", sans-serif' }}>
                      {isMe ? 'You' : (entry.name ?? 'Unknown')}
                    </p>
                    {entry.currentStreak >= 2 && (
                      <p style={{ margin: 0, fontSize: 11, color: '#EA580C' }}>🔥 {entry.currentStreak}-day streak</p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#B45309', background: '#FFFBEB', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
                    {entry.totalPoints} pts
                  </span>
                </div>
              )
            }

            // Preview leaderboard row (sessionStorage members, all at 0 pts)
            const PreviewRow = ({ m, i, total }: { m: PreviewMember; i: number; total: number }) => {
              const isYou   = !!m.isMe
              const isEmoji = m.avatarUrl?.startsWith('emoji:')
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < total - 1 ? '1px solid #F7F8FA' : 'none',
                  background: isYou ? '#FFF9F7' : 'transparent',
                  borderLeft: isYou ? '3px solid #FF6B2B' : '3px solid transparent',
                }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>
                    {medals[i] ?? <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF' }}>#{i + 1}</span>}
                  </span>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: m.color, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isEmoji ? 17 : 12, fontWeight: 700, color: '#fff',
                    overflow: 'hidden',
                  }}>
                    {isEmoji
                      ? m.avatarUrl!.slice(6)
                      : m.avatarUrl
                        ? <Image src={m.avatarUrl} alt={m.name ?? ''} width={34} height={34} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                        : initials(m.name)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: isYou ? 800 : 600, color: isYou ? '#FF6B2B' : '#111827', fontFamily: '"Poppins", sans-serif' }}>
                      {isYou ? 'You' : (m.name ?? 'Unknown')}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>Complete chores to earn points</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
                    0 pts
                  </span>
                </div>
              )
            }

            const showReal    = leaderboard.length > 0
            const showPreview = !showReal && previewMembers.length > 0

            if (!showReal && !showPreview) return null

            return (
              <section style={{ marginBottom: 24 }}>
                <SectionTitle icon="🏆" label="Leaderboard" color="#B45309" />
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                  {showReal
                    ? leaderboard.slice(0, 5).map((entry, i) => (
                        <RealRow key={entry.userId} entry={entry} i={i} total={Math.min(leaderboard.length, 5)} />
                      ))
                    : previewMembers.map((m, i) => (
                        <PreviewRow key={m.id ?? i} m={m} i={i} total={previewMembers.length} />
                      ))
                  }
                </div>
              </section>
            )
          })()}
        </main>

        {/* ── Bottom nav ────────────────────────────────────────────────────── */}
        <BottomNav />
      </div>

      {completeSheet && (
        <CompleteChoreSheet
          chore={completeSheet}
          onClose={() => setCompleteSheet(null)}
          onDone={handleSheetDone}
        />
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Onboarding setup summary row — iOS-style settings cell
function SetupRow({
  icon, iconBg, iconFg, label, value, sub, isLast,
}: {
  icon:    string
  iconBg:  string
  iconFg:  string
  label:   string
  value:   string
  sub?:    string
  isLast?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : '0.5px solid #F0F0F0',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        background: iconBg, color: iconFg,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#111827',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
        {sub && (
          <p style={{
            margin: '2px 0 0', fontSize: 11, color: '#9CA3AF',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ icon, label, count, color }: {
  icon:   string
  label:  string
  count?: number
  color:  string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <h2 style={{
        fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 12,
        color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
      }}>
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#9CA3AF',
          background: '#F3F4F6', borderRadius: 99, padding: '1px 8px',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

const PRIORITY_BAR: Record<string, string> = {
  low:    '#10B981',
  medium: '#F59E0B',
  high:   '#EF4444',
}

function ChoreCard({ chore, variant, pending, onQuickComplete, onDone, markDoneLabel }: {
  chore:           ChoreWithAssignee
  variant:         'overdue' | 'today'
  pending:         boolean
  onQuickComplete: () => void
  onDone:          () => void
  markDoneLabel?:  string
}) {
  const catMeta     = CATEGORY_META[chore.category]
  const isRecurring = chore.frequency !== 'one-time'
  const barColor    = PRIORITY_BAR[chore.priority] ?? '#9CA3AF'
  const isOverdue   = variant === 'overdue'

  return (
    <div style={{
      background:   isOverdue ? '#FFF9F9' : '#fff',
      borderRadius: 16,
      border:       `1px solid ${isOverdue ? '#FECACA' : '#F0F0F0'}`,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 14px 14px 0',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Priority stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: barColor }} />

      {/* Circle complete button */}
      <button
        type="button"
        onClick={onQuickComplete}
        disabled={pending}
        aria-label={markDoneLabel ?? 'Mark done'}
        style={{
          marginLeft: 14, flexShrink: 0,
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${isOverdue ? '#FCA5A5' : '#D1D5DB'}`,
          background: 'transparent', cursor: pending ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.borderColor = '#FF6B2B'
          b.style.background  = '#FFF3EE'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.borderColor = isOverdue ? '#FCA5A5' : '#D1D5DB'
          b.style.background  = 'transparent'
        }}
      >
        {pending ? <SpinSVG /> : <CheckSVG />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{catMeta.emoji}</span>
          <p style={{
            fontFamily: '"Poppins", sans-serif', fontWeight: 600,
            fontSize: 14, color: '#111827', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {chore.name}
          </p>
        </div>
        {chore.description && (
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chore.description}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
          {chore.points > 0 && (
            <Chip bg="#FFFBEB" color="#B45309">🏆 {chore.points} pts</Chip>
          )}
          {isOverdue && chore.due_date && (
            <Chip bg="#FEF2F2" color="#DC2626">Overdue · {formatDue(chore.due_date)}</Chip>
          )}
          {isRecurring && (
            <Chip bg="#EEF2FF" color="#4338CA">🔁 {chore.frequency}</Chip>
          )}
          {!!chore.estimated_mins && (
            <Chip bg="#F9FAFB" color="#6B7280">⏱ {chore.estimated_mins}m</Chip>
          )}
        </div>
      </div>

      {/* Done button */}
      <DoneButton onClick={onDone} label={markDoneLabel} />
    </div>
  )
}

function DoneButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        flexShrink: 0,
        borderRadius: 12,
        background: hovered ? '#e85a1f' : '#FF6B2B',
        color: '#fff', border: 'none',
        fontSize: 13, fontFamily: '"Poppins", sans-serif', fontWeight: 700,
        padding: '9px 16px', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(255,107,43,0.3)',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'background 0.15s, transform 0.1s',
      }}
    >
      {label ?? 'Done'}
    </button>
  )
}

function ActivityRow({
  item, isLast, isMe, currentUserId, onReactionToggle,
}: {
  item:              ActivityEntry
  isLast:            boolean
  isMe:              boolean
  currentUserId:     string
  onReactionToggle:  (completionId: string, emoji: string, alreadyReacted: boolean) => void
}) {
  const catMeta     = (CATEGORY_META as Record<string, { emoji: string }>)[item.category] ?? { emoji: '🧹' }
  const displayName = isMe ? 'You' : (item.member?.name?.split(' ')[0] ?? 'Someone')
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  // Group reactions by emoji
  const grouped: Record<string, string[]> = {}
  for (const r of item.reactions) {
    ;(grouped[r.emoji] ??= []).push(r.userId)
  }

  return (
    <div style={{
      padding: '13px 16px',
      borderBottom: isLast ? 'none' : '1px solid #F7F8FA',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Member avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: item.member?.color ?? '#E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
          overflow: 'hidden',
        }}>
          {item.member?.avatarUrl ? (
            <Image
              src={item.member.avatarUrl}
              alt={item.member.name ?? ''}
              width={38} height={38}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              unoptimized
            />
          ) : (
            initials(item.member?.name ?? null)
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.45 }}>
            <span style={{ fontWeight: 800, color: isMe ? '#FF6B2B' : '#111827' }}>
              {displayName}
            </span>
            {' '}completed{' '}
            <span style={{ fontWeight: 700 }}>{catMeta.emoji} {item.choreName}</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{timeAgo(item.completedAt)}</span>
            {item.points > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#B45309',
                background: '#FFFBEB', borderRadius: 99, padding: '1px 7px',
              }}>
                +{item.points} pts
              </span>
            )}
            {item.wasOnTime === false && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#EF4444' }}>late</span>
            )}
          </div>
        </div>
      </div>

      {/* Reaction bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, marginLeft: 50, flexWrap: 'wrap', position: 'relative' }}>
        {Object.entries(grouped).map(([emoji, users]) => {
          const mine = users.includes(currentUserId)
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReactionToggle(item.id, emoji, mine)}
              aria-label={`${mine ? 'Remove' : 'Add'} ${emoji} reaction (${users.length})`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                borderRadius: 99,
                border: mine ? '1.5px solid #818CF8' : '1.5px solid #E5E7EB',
                cursor: 'pointer',
                padding: '3px 9px', fontSize: 13, fontWeight: 700,
                background: mine ? '#EEF2FF' : '#fff',
                color: mine ? '#4338CA' : '#374151',
                transition: 'all 0.15s',
                boxShadow: mine ? '0 0 0 2px rgba(99,102,241,0.1)' : 'none',
              }}
            >
              {emoji} <span style={{ fontSize: 12 }}>{users.length}</span>
            </button>
          )
        })}

        {/* Add reaction button — always visible so users know they can react */}
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            aria-label="Add reaction"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              borderRadius: 99,
              border: '1.5px dashed #D1D5DB',
              background: pickerOpen ? '#F9FAFB' : '#fff',
              cursor: 'pointer',
              padding: '3px 9px', fontSize: 13, color: '#6B7280',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.borderColor = '#FF6B2B'
              b.style.color = '#FF6B2B'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              if (!pickerOpen) {
                b.style.borderColor = '#D1D5DB'
                b.style.color = '#6B7280'
              }
            }}
          >
            <span style={{ fontSize: 14 }}>😊</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>React</span>
          </button>

          {pickerOpen && (
            <div style={{
              position: 'absolute', bottom: 36, left: 0, zIndex: 60,
              background: '#fff', borderRadius: 14,
              boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
              border: '1px solid #F0F0F0', padding: '8px 10px',
              display: 'flex', gap: 4,
            }}>
              {REACTION_EMOJIS.map(emoji => {
                const mine = (grouped[emoji] ?? []).includes(currentUserId)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { setPickerOpen(false); onReactionToggle(item.id, emoji, mine) }}
                    title={mine ? `Remove ${emoji}` : `React with ${emoji}`}
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      border: mine ? '2px solid #818CF8' : '2px solid transparent',
                      background: mine ? '#EEF2FF' : 'none',
                      cursor: 'pointer', fontSize: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                      transform: 'scale(1)',
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background = mine ? '#E0E7FF' : '#F3F4F6'
                      b.style.transform = 'scale(1.2)'
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background = mine ? '#EEF2FF' : 'none'
                      b.style.transform = 'scale(1)'
                    }}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AvatarCircle({ user, color, size }: { user: UserRow; color?: string; size: number }) {
  const isEmoji = user.avatar_url?.startsWith('emoji:')
  const emoji   = isEmoji ? user.avatar_url!.slice(6) : null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color ?? '#6366F1', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isEmoji ? size * 0.55 : size * 0.35, fontWeight: 700, color: '#fff',
      overflow: 'hidden',
    }}>
      {emoji ? (
        emoji
      ) : user.avatar_url ? (
        <Image
          src={user.avatar_url} alt={user.full_name ?? ''}
          width={size} height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          unoptimized
        />
      ) : (
        initials(user.full_name)
      )}
    </div>
  )
}

function Chip({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 700, borderRadius: 99,
      padding: '2px 8px', background: bg, color,
    }}>
      {children}
    </span>
  )
}


// ─── SVG Icons ────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function CheckSVG() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function SpinSVG() {
  return (
    <svg style={{ width: 13, height: 13, animation: 'cs-spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
      <style>{`@keyframes cs-spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="#D1D5DB" strokeWidth="3" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── Font import ──────────────────────────────────────────────────────────────

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
`
