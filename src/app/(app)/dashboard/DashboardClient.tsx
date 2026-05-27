'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { completeChore } from '@/lib/actions/chores'
import { addCompletionReaction, removeCompletionReaction } from '@/lib/actions/reactions'
import CompleteChoreSheet from '@/components/chores/CompleteChoreSheet'
import { CATEGORY_META } from '@/components/chores/ChoreModal'
import type { ChoreWithAssignee, UserRow } from '@/lib/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

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

function greeting(name: string | null) {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${name?.split(' ')[0] ?? 'there'} 👋`
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
}: DashboardClientProps) {
  const router = useRouter()
  const [overdueChores,  setOverdueChores]  = useState(initialOverdue)
  const [todayChores,    setTodayChores]    = useState(initialToday)
  const [recentActivity, setRecentActivity] = useState(initialActivity)
  const [completeSheet,  setCompleteSheet]  = useState<ChoreWithAssignee | null>(null)
  const [quickPending,   setQuickPending]   = useState<Set<string>>(new Set())
  const [dismissedPins,  setDismissedPins]  = useState<Set<string>>(new Set())
  const [switcherOpen,   setSwitcherOpen]   = useState(false)
  const [, startTransition]                 = useTransition()

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

      <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: '"Nunito", sans-serif', paddingBottom: 80 }}>

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
              onClick={() => allHouseholds.length > 1 && setSwitcherOpen(o => !o)}
              style={{
                fontSize: 12, fontWeight: 700, color: '#6B7280',
                background: '#F3F4F6', borderRadius: 99, padding: '4px 10px',
                border: 'none', cursor: allHouseholds.length > 1 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {householdName}
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

            <AvatarCircle user={currentUser} color={colorMap[currentUser.id]} size={32} />
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
              {greeting(currentUser.full_name)}
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
              <SectionTitle icon="⚠️" label="Overdue" count={overdueChores.length} color="#EF4444" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overdueChores.map(chore => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    variant="overdue"
                    pending={quickPending.has(chore.id)}
                    onQuickComplete={() => handleQuickComplete(chore)}
                    onDone={() => setCompleteSheet(chore)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Today ────────────────────────────────────────────────────────── */}
          <section style={{ marginBottom: 20 }}>
            <SectionTitle icon="📋" label="Due Today" count={todayChores.length} color="#FF6B2B" />
            {todayChores.length === 0 ? (
              <div style={{
                background: '#fff', borderRadius: 16, border: '1.5px dashed #E5E7EB',
                padding: '32px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15, color: '#374151', margin: 0 }}>
                  {overdueChores.length > 0 ? 'No new chores today' : 'Nothing due today'}
                </p>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: '6px 0 0' }}>
                  Check the{' '}
                  <a href="/chores" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none' }}>Chores tab</a>
                  {' '}for upcoming tasks
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todayChores.map(chore => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    variant="today"
                    pending={quickPending.has(chore.id)}
                    onQuickComplete={() => handleQuickComplete(chore)}
                    onDone={() => setCompleteSheet(chore)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Activity feed ─────────────────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionTitle icon="📡" label="Recent Activity" color="#6B7280" />
            {recentActivity.length === 0 ? (
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0',
                padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏡</div>
                <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
                  No activity yet — start completing chores!
                </p>
              </div>
            ) : (
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
            )}
          </section>
        </main>

        {/* ── Bottom nav ────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: '#fff', borderTop: '1px solid #F0F0F0',
          display: 'flex', alignItems: 'center',
          height: 68, padding: '0 8px 6px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        }}>
          <BottomNavItem href="/dashboard" label="Home"     icon={<HomeIcon />}     active />
          <BottomNavItem href="/chores"    label="Chores"   icon={<ChoresIcon />}         />
          <BottomNavItem href="/calendar"  label="Calendar" icon={<CalendarIcon />}       />
          <BottomNavItem href="/social"    label="Chat"     icon={<ChatIcon />}           />
          <BottomNavItem href="/profile"   label="Profile"  icon={<ProfileIcon />}        />
        </nav>
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

function ChoreCard({ chore, variant, pending, onQuickComplete, onDone }: {
  chore:           ChoreWithAssignee
  variant:         'overdue' | 'today'
  pending:         boolean
  onQuickComplete: () => void
  onDone:          () => void
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
        aria-label="Mark done"
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
      <DoneButton onClick={onDone} />
    </div>
  )
}

function DoneButton({ onClick }: { onClick: () => void }) {
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
      Done
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: 50, position: 'relative' }}>
        {Object.entries(grouped).map(([emoji, users]) => {
          const mine = users.includes(currentUserId)
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReactionToggle(item.id, emoji, mine)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                borderRadius: 99, border: 'none', cursor: 'pointer',
                padding: '2px 7px', fontSize: 12, fontWeight: 700,
                background: mine ? '#EEF2FF' : '#F3F4F6',
                color: mine ? '#4338CA' : '#6B7280',
                transition: 'background 0.15s',
              }}
            >
              {emoji} {users.length}
            </button>
          )
        })}

        {/* Add reaction "+" button */}
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none',
              background: 'none', cursor: 'pointer', fontSize: 14, color: '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            aria-label="Add reaction"
          >
            +
          </button>

          {pickerOpen && (
            <div style={{
              position: 'absolute', bottom: 30, left: 0, zIndex: 60,
              background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid #F0F0F0', padding: '6px 8px',
              display: 'flex', gap: 4,
            }}>
              {REACTION_EMOJIS.map(emoji => {
                const mine = (grouped[emoji] ?? []).includes(currentUserId)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { setPickerOpen(false); onReactionToggle(item.id, emoji, mine) }}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: 'none',
                      background: mine ? '#EEF2FF' : 'none',
                      cursor: 'pointer', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!mine) (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB' }}
                    onMouseLeave={e => { if (!mine) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
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
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color ?? '#6366F1', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      overflow: 'hidden',
    }}>
      {user.avatar_url ? (
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

function BottomNavItem({ href, label, icon, active }: {
  href:   string
  label:  string
  icon:   React.ReactNode
  active?: boolean
}) {
  return (
    <a href={href} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 3, textDecoration: 'none',
      color: active ? '#FF6B2B' : '#9CA3AF',
      padding: '4px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{
        fontSize: 10, fontFamily: '"Nunito", sans-serif',
        fontWeight: active ? 800 : 600,
        letterSpacing: '0.01em',
      }}>
        {label}
      </span>
    </a>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IC = { width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function HomeIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function ChoresIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}
function ProfileIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
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
