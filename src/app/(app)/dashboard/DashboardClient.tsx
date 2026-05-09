'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { completeChore } from '@/lib/actions/chores'
import CompleteChoreSheet from '@/components/chores/CompleteChoreSheet'
import { CATEGORY_META } from '@/components/chores/ChoreModal'
import type { ChoreWithAssignee, UserRow, LeaderboardEntry, AnnouncementWithAuthor } from '@/lib/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(name: string | null) {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${name?.split(' ')[0] ?? 'there'}`
}

function memberInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDue(iso: string) {
  const today = new Date()
  const d = new Date(iso)
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth()    === today.getMonth() &&
    d.getDate()     === today.getDate()
  ) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  currentUser:           UserRow
  myOverdueChores:       ChoreWithAssignee[]
  myTodayChores:         ChoreWithAssignee[]
  weekDoneCount:         number
  totalActiveCount:      number
  householdName:         string
  householdId:           string
  colorMap:              Record<string, string>
  leaderboard:           LeaderboardEntry[]
  myStreak:              { current_streak: number; total_completions: number } | null
  pinnedAnnouncements:   AnnouncementWithAuthor[]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({
  currentUser,
  myOverdueChores:  initialOverdue,
  myTodayChores:    initialToday,
  weekDoneCount:    initialWeekDone,
  totalActiveCount,
  householdName,
  colorMap,
  leaderboard,
  myStreak,
  pinnedAnnouncements,
}: DashboardClientProps) {
  const router = useRouter()
  const [overdueChores,  setOverdueChores]  = useState(initialOverdue)
  const [todayChores,    setTodayChores]    = useState(initialToday)
  const [weekDone,       setWeekDone]       = useState(initialWeekDone)
  const [completeSheet,  setCompleteSheet]  = useState<ChoreWithAssignee | null>(null)
  const [quickPending,   setQuickPending]   = useState<Set<string>>(new Set())
  const [leaderboardTab,    setLeaderboardTab]    = useState<'week' | 'alltime'>('week')
  const [dismissedPins,     setDismissedPins]     = useState<Set<string>>(new Set())
  const [, startTransition]                        = useTransition()

  const visiblePins = pinnedAnnouncements.filter(a => !dismissedPins.has(a.id))

  const removeFromLists = useCallback((choreId: string) => {
    setOverdueChores(prev => prev.filter(c => c.id !== choreId))
    setTodayChores(prev   => prev.filter(c => c.id !== choreId))
    setWeekDone(prev => prev + 1)
  }, [])

  function handleQuickComplete(chore: ChoreWithAssignee) {
    setQuickPending(prev => new Set(prev).add(chore.id))
    startTransition(async () => {
      const result = await completeChore(chore.id)
      if (!result?.error) {
        removeFromLists(chore.id)
        router.refresh()
      }
      setQuickPending(prev => { const s = new Set(prev); s.delete(chore.id); return s })
    })
  }

  function handleSheetDone(choreId: string) {
    removeFromLists(choreId)
    router.refresh()
  }

  const totalToday  = overdueChores.length + todayChores.length
  const hasPoints   = leaderboard.some(e => e.pointsAllTime > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)' }}>
      {/* Nav */}
      <header className="app-header">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>{householdName}</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            <NavLink href="/dashboard" label="Home"      active />
            <NavLink href="/chores"    label="Chores"           />
            <NavLink href="/calendar"  label="📅"               />
            <NavLink href="/social"    label="💬"               />
            <NavLink href="/history"   label="📊"               />
            <NavLink href="/rewards"   label="🏆"               />
            <NavLink href="/household" label="House"            />
            <NavLink href="/settings"  label="⚙️"               />
            <NavLink href="/profile"   label="Profile"          />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">

        {/* Greeting */}
        <section className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ background: colorMap[currentUser.id] ?? '#6366f1' }}
          >
            {currentUser.avatar_url ? (
              <Image src={currentUser.avatar_url} alt={currentUser.full_name ?? ''} width={44} height={44} className="h-full w-full object-cover" unoptimized />
            ) : (
              memberInitials(currentUser.full_name)
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900">
              {greeting(currentUser.full_name)}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">
                {totalToday === 0
                  ? "You're all caught up 🎉"
                  : `${totalToday} chore${totalToday !== 1 ? 's' : ''} need${totalToday === 1 ? 's' : ''} your attention`}
              </p>
              {myStreak && myStreak.current_streak >= 2 && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
                  🔥 {myStreak.current_streak}-day streak
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pinned announcements */}
        {visiblePins.length > 0 && (
          <section className="space-y-2">
            {visiblePins.map(ann => (
              <div
                key={ann.id}
                className="relative flex gap-3 overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 shadow-sm"
              >
                <span className="mt-0.5 flex-shrink-0 text-base">📌</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-0.5">
                    Pinned · {ann.author?.full_name ?? 'Admin'}
                  </p>
                  <p className="text-sm text-slate-700 leading-snug">{ann.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedPins(prev => new Set(prev).add(ann.id))}
                  className="flex-shrink-0 self-start rounded-full p-1 text-indigo-300 hover:bg-indigo-100 hover:text-indigo-600 transition"
                  aria-label="Dismiss announcement"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Weekly progress */}
        <WeeklyProgress done={weekDone} total={totalActiveCount} />

        {/* Leaderboard */}
        {hasPoints && (
          <Leaderboard
            entries={leaderboard}
            currentUserId={currentUser.id}
            tab={leaderboardTab}
            onTabChange={setLeaderboardTab}
          />
        )}

        {/* Overdue */}
        {overdueChores.length > 0 && (
          <section>
            <SectionHeader label="Overdue" count={overdueChores.length} accent="text-red-600" icon="⚠️" />
            <div className="space-y-3">
              {overdueChores.map(chore => (
                <DashChoreCard
                  key={chore.id}
                  chore={chore}
                  variant="overdue"
                  isPending={quickPending.has(chore.id)}
                  onComplete={() => setCompleteSheet(chore)}
                  onQuickComplete={() => handleQuickComplete(chore)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Today */}
        <section>
          <SectionHeader label="Due Today" count={todayChores.length} accent="text-indigo-600" icon="📅" />
          {todayChores.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-2 font-semibold text-slate-700">
                {overdueChores.length > 0 ? 'No new chores today' : 'Nothing due today'}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Check the{' '}
                <a href="/chores" className="text-indigo-500 underline underline-offset-2">Chores tab</a>{' '}
                to see upcoming tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayChores.map(chore => (
                <DashChoreCard
                  key={chore.id}
                  chore={chore}
                  variant="today"
                  isPending={quickPending.has(chore.id)}
                  onComplete={() => setCompleteSheet(chore)}
                  onQuickComplete={() => handleQuickComplete(chore)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick links</p>
          <div className="grid grid-cols-4 gap-3">
            <QuickLink href="/chores"    emoji="🧹" label="Chores"   />
            <QuickLink href="/calendar"  emoji="📅" label="Calendar" />
            <QuickLink href="/rewards"   emoji="🏆" label="Rewards"  />
            <QuickLink href="/household" emoji="🏠" label="Household"/>
          </div>
        </section>
      </main>

      {completeSheet && (
        <CompleteChoreSheet
          chore={completeSheet}
          onClose={() => setCompleteSheet(null)}
          onDone={handleSheetDone}
        />
      )}
    </div>
  )
}

// ── Leaderboard widget ────────────────────────────────────────────────────────

function Leaderboard({
  entries,
  currentUserId,
  tab,
  onTabChange,
}: {
  entries:       LeaderboardEntry[]
  currentUserId: string
  tab:           'week' | 'alltime'
  onTabChange:   (t: 'week' | 'alltime') => void
}) {
  const sorted = [...entries].sort((a, b) =>
    tab === 'week'
      ? b.pointsThisWeek - a.pointsThisWeek
      : b.pointsAllTime  - a.pointsAllTime
  )

  const topScore = sorted[0]?.[tab === 'week' ? 'pointsThisWeek' : 'pointsAllTime'] ?? 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <p className="font-semibold text-slate-900">Leaderboard</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {(['week', 'alltime'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'week' ? 'This week' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50">
        {sorted.slice(0, 5).map((entry, idx) => {
          const pts = tab === 'week' ? entry.pointsThisWeek : entry.pointsAllTime
          const isMe = entry.userId === currentUserId
          const pct  = topScore > 0 ? (pts / topScore) * 100 : 0
          const medals = ['🥇', '🥈', '🥉']

          return (
            <div key={entry.userId} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-indigo-50/60' : ''}`}>
              {/* Rank */}
              <span className="w-6 text-center text-sm">
                {idx < 3 ? medals[idx] : <span className="font-semibold text-slate-400">{idx + 1}</span>}
              </span>

              {/* Avatar */}
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                style={{ background: entry.color }}
              >
                {entry.avatarUrl ? (
                  <Image src={entry.avatarUrl} alt={entry.name ?? ''} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                ) : (
                  memberInitials(entry.name)
                )}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-none ${isMe ? 'text-indigo-700' : 'text-slate-900'}`}>
                  {isMe ? 'You' : (entry.name ?? 'Unknown')}
                </p>
                {topScore > 0 && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: entry.color }}
                    />
                  </div>
                )}
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <span className={`text-sm font-bold ${pts > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                  {pts}
                </span>
                <span className="ml-0.5 text-xs text-slate-400">pts</span>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.every(e => (tab === 'week' ? e.pointsThisWeek : e.pointsAllTime) === 0) && (
        <p className="px-4 py-4 text-center text-sm text-slate-400">
          No points earned {tab === 'week' ? 'this week' : 'yet'}. Complete chores to score!
        </p>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WeeklyProgress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100))
  const allDone = done >= total && total > 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">This week</p>
        <p className="text-sm font-bold text-slate-900">
          {done} <span className="font-normal text-slate-400">of {total} done</span>
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            allDone ? 'bg-emerald-500' : pct >= 75 ? 'bg-indigo-500' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {allDone && (
        <p className="mt-2 text-xs font-semibold text-emerald-600">All chores complete this week! 🎉</p>
      )}
    </div>
  )
}

function SectionHeader({ label, count, accent, icon }: { label: string; count: number; accent: string; icon: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base leading-none">{icon}</span>
      <h2 className={`text-sm font-bold uppercase tracking-wide ${accent}`}>{label}</h2>
      {count > 0 && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
      )}
    </div>
  )
}

const PRIORITY_DOT: Record<string, string> = {
  low:    'bg-emerald-400',
  medium: 'bg-amber-400',
  high:   'bg-red-500',
}

function DashChoreCard({ chore, variant, isPending, onComplete, onQuickComplete }: {
  chore:           ChoreWithAssignee
  variant:         'overdue' | 'today'
  isPending:       boolean
  onComplete:      () => void
  onQuickComplete: () => void
}) {
  const catMeta   = CATEGORY_META[chore.category]
  const isRecurring = chore.frequency !== 'one-time'

  return (
    <div className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition
      ${variant === 'overdue' ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_DOT[chore.priority]}`} />

      <button
        type="button"
        onClick={onQuickComplete}
        disabled={isPending}
        aria-label="Mark as complete"
        className={`ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition
          ${variant === 'overdue' ? 'border-red-400 hover:border-red-500 hover:bg-red-50' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'}
          disabled:opacity-50`}
      >
        {isPending && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none flex-shrink-0">{catMeta.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug text-slate-900 truncate">{chore.name}</p>
            {chore.description && <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{chore.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {chore.points > 0 && (
            <span className="rounded-full bg-yellow-50 px-2 py-0.5 font-semibold text-yellow-700">🏆 {chore.points} pts</span>
          )}
          {variant === 'overdue' && chore.due_date && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-600">
              Overdue · {formatDue(chore.due_date)}
            </span>
          )}
          {isRecurring && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600">🔁 {chore.frequency}</span>
          )}
          {chore.estimated_mins && <span className="text-slate-400">⏱ {chore.estimated_mins} min</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="flex-shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 active:scale-95"
      >
        Done
      </button>
    </div>
  )
}

function NavLink({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return (
    <a href={href} className={`nav-link${active ? ' active' : ''}`}>
      {label}
    </a>
  )
}

function QuickLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-95"
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
    </a>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
