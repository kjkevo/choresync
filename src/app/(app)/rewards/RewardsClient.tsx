'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BADGE_META, ALL_BADGE_TYPES, type BadgeType } from '@/lib/badges'
import type { BadgeRow, UserRow } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HouseholdStreakEntry {
  userId:           string
  name:             string | null
  avatarUrl:        string | null
  color:            string
  currentStreak:    number
  longestStreak:    number
  totalCompletions: number
}

interface RewardsClientProps {
  currentUser:         UserRow
  myBadges:            BadgeRow[]
  myStreak:            { current_streak: number; longest_streak: number; total_completions: number } | null
  totalPoints:         number
  householdStreaks:    HouseholdStreakEntry[]
  currentUserId:       string
  colorMap:            Record<string, string>
  allHouseholdBadges:  { user_id: string; badge_type: string; earned_at: string }[]
  profileMap:          Record<string, UserRow>
}

type TabKey = 'my-badges' | 'achievements' | 'household'

// ── Rarity styles ─────────────────────────────────────────────────────────────

const RARITY_EARNED: Record<string, string> = {
  common: 'from-slate-100  to-slate-200  border-slate-300',
  rare:   'from-violet-100 to-indigo-100 border-violet-300',
  epic:   'from-amber-100  to-orange-100 border-amber-400',
}

const RARITY_GLOW: Record<string, string> = {
  common: '',
  rare:   'shadow-violet-200',
  epic:   'shadow-amber-200',
}

const RARITY_LABEL: Record<string, string> = {
  common: 'text-slate-500  bg-slate-100',
  rare:   'text-violet-700 bg-violet-100',
  epic:   'text-amber-700  bg-amber-100',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatBadgeDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RewardsClient({
  currentUser,
  myBadges,
  myStreak,
  totalPoints,
  householdStreaks,
  currentUserId,
  colorMap,
  allHouseholdBadges,
  profileMap,
}: RewardsClientProps) {
  const [tab, setTab] = useState<TabKey>('my-badges')

  const earnedTypes = new Set(myBadges.map(b => b.badge_type as BadgeType))
  const streak      = myStreak?.current_streak    ?? 0
  const bestStreak  = myStreak?.longest_streak    ?? 0
  const totalChores = myStreak?.total_completions ?? 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)' }}>
      {/* Nav */}
      <header className="app-header">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>Rewards</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {[
              { href: '/dashboard', label: 'Home'     },
              { href: '/chores',    label: 'Chores'   },
              { href: '/calendar',  label: '📅'        },
              { href: '/social',    label: '💬'        },
              { href: '/history',   label: '📊'        },
              { href: '/rewards',   label: '🏆', active: true },
              { href: '/household', label: 'House'    },
              { href: '/settings',  label: '⚙️'        },
              { href: '/profile',   label: 'Profile'  },
            ].map(({ href, label, active }) => (
              <a key={href} href={href} className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 pb-20 pt-10 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
              style={{ background: colorMap[currentUser.id] ?? '#6366f1' }}
            >
              {currentUser.avatar_url ? (
                <Image src={currentUser.avatar_url} alt={currentUser.full_name ?? ''} width={48} height={48} className="h-full w-full object-cover" unoptimized />
              ) : (
                memberInitials(currentUser.full_name)
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold">Rewards & Badges</h1>
              <p className="text-sm text-indigo-200">
                {currentUser.full_name ?? currentUser.email?.split('@')[0]}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[
              { icon: '🔥', value: streak,      label: 'Day streak'  },
              { icon: '📈', value: bestStreak,  label: 'Best streak' },
              { icon: '✅', value: totalChores, label: 'Chores done' },
              { icon: '🏆', value: totalPoints, label: 'Points'      },
            ].map(({ icon, value, label }) => (
              <div key={label} className="rounded-2xl bg-white/10 px-3 py-3 text-center backdrop-blur-sm">
                <p className="text-xl leading-none">{icon}</p>
                <p className="mt-1 text-lg font-bold">{value}</p>
                <p className="text-[10px] text-indigo-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto -mt-8 max-w-2xl px-4 pb-24">

        {/* Tab bar */}
        <div className="mb-4 flex rounded-2xl bg-white p-1 shadow-sm border border-slate-100">
          {([
            { key: 'my-badges',    label: `My Badges (${myBadges.length})`  },
            { key: 'achievements', label: 'All Achievements'                 },
            { key: 'household',    label: 'Household'                        },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition
                ${tab === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: My Badges ──────────────────────────────────────────────── */}
        {tab === 'my-badges' && (
          myBadges.length === 0 ? (
            <EmptyBadges />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {myBadges.map(badge => (
                <EarnedBadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          )
        )}

        {/* ── Tab: All Achievements ───────────────────────────────────────── */}
        {tab === 'achievements' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_BADGE_TYPES.map(type => {
              const earned = myBadges.filter(b => b.badge_type === type)
              const meta   = BADGE_META[type]
              return (
                <AchievementCard
                  key={type}
                  type={type}
                  latestEarned={earned[0] ?? null}
                  earnedCount={earned.length}
                  streak={streak}
                  totalChores={totalChores}
                />
              )
            })}
          </div>
        )}

        {/* ── Tab: Household ──────────────────────────────────────────────── */}
        {tab === 'household' && (
          <div className="space-y-4">
            {/* Streak leaderboard */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="font-semibold text-slate-900">🔥 Streak Leaderboard</h2>
                <p className="text-xs text-slate-400">Consecutive days with at least one chore completed</p>
              </div>
              <div className="divide-y divide-slate-50">
                {householdStreaks.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No streaks yet — complete some chores!</p>
                ) : (
                  householdStreaks
                    .sort((a, b) => b.currentStreak - a.currentStreak)
                    .map((entry, idx) => (
                      <StreakRow
                        key={entry.userId}
                        entry={entry}
                        rank={idx + 1}
                        isMe={entry.userId === currentUserId}
                      />
                    ))
                )}
              </div>
            </div>

            {/* Who has which badges */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="font-semibold text-slate-900">🏅 Recent Household Badges</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {allHouseholdBadges.slice(0, 10).map((b, i) => {
                  const meta    = BADGE_META[b.badge_type as BadgeType]
                  const profile = profileMap[b.user_id]
                  const color   = colorMap[b.user_id] ?? '#6366f1'
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                        style={{ background: color }}
                      >
                        {profile?.avatar_url ? (
                          <Image src={profile.avatar_url} alt={profile.full_name ?? ''} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          memberInitials(profile?.full_name ?? null)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {b.user_id === currentUserId ? 'You' : (profile?.full_name ?? 'Unknown')}
                        </p>
                        <p className="text-xs text-slate-500">earned {meta?.emoji} {meta?.label}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-slate-400">
                        {formatBadgeDate(b.earned_at)}
                      </span>
                    </div>
                  )
                })}
                {allHouseholdBadges.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No badges earned yet in this household.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EarnedBadgeCard({ badge }: { badge: BadgeRow }) {
  const meta    = BADGE_META[badge.badge_type as BadgeType]
  const rarity  = meta?.rarity ?? 'common'
  const brandNew = isNew(badge.earned_at)

  return (
    <div className={`relative flex flex-col items-center rounded-2xl border-2 bg-gradient-to-b p-4 text-center shadow-md
      ${RARITY_EARNED[rarity]} ${rarity !== 'common' ? RARITY_GLOW[rarity] + ' shadow-lg' : 'shadow-sm'}`}>
      {brandNew && (
        <span className="absolute -top-2 right-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
          NEW
        </span>
      )}
      <span className="text-4xl leading-none">{meta?.emoji ?? '🏅'}</span>
      <p className="mt-2 text-xs font-bold text-slate-900">{meta?.label}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{meta?.desc}</p>
      <span className={`mt-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${RARITY_LABEL[rarity]}`}>
        {rarity}
      </span>
      <p className="mt-1.5 text-[10px] text-slate-400">{formatBadgeDate(badge.earned_at)}</p>
    </div>
  )
}

function AchievementCard({
  type,
  latestEarned,
  earnedCount,
  streak,
  totalChores,
}: {
  type:         BadgeType
  latestEarned: BadgeRow | null
  earnedCount:  number
  streak:       number
  totalChores:  number
}) {
  const meta    = BADGE_META[type]
  const earned  = !!latestEarned
  const rarity  = meta.rarity

  const progress = getProgress(type, streak, totalChores)

  return (
    <div className={`flex flex-col items-center rounded-2xl border-2 p-4 text-center transition
      ${earned
        ? `bg-gradient-to-b ${RARITY_EARNED[rarity]} shadow-md`
        : 'border-slate-200 bg-white opacity-60'
      }`}>
      <div className="relative">
        <span className={`text-4xl leading-none ${earned ? '' : 'grayscale'}`}>{meta.emoji}</span>
        {!earned && (
          <span className="absolute -bottom-1 -right-1 text-base leading-none">🔒</span>
        )}
      </div>
      <p className={`mt-2 text-xs font-bold ${earned ? 'text-slate-900' : 'text-slate-400'}`}>
        {meta.label}
      </p>
      {earned ? (
        <>
          <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${RARITY_LABEL[rarity]}`}>
            {rarity}
          </span>
          {earnedCount > 1 && (
            <p className="mt-1 text-[10px] text-slate-400">×{earnedCount}</p>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            {formatBadgeDate(latestEarned!.earned_at)}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-400">{progress}</p>
      )}
    </div>
  )
}

function getProgress(type: BadgeType, streak: number, totalChores: number): string {
  switch (type) {
    case 'first_chore':     return 'Complete your first chore'
    case 'chores_10':       return `${totalChores}/10 chores`
    case 'chores_100':      return `${totalChores}/100 chores`
    case 'streak_7':        return `${streak}/7 day streak`
    case 'streak_30':       return `${streak}/30 day streak`
    case 'top_contributor': return 'Be #1 in points this month'
  }
}

function StreakRow({ entry, rank, isMe }: { entry: HouseholdStreakEntry; rank: number; isMe: boolean }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-indigo-50/60' : ''}`}>
      <span className="w-6 text-center text-sm">
        {rank <= 3 ? medals[rank - 1] : <span className="font-semibold text-slate-400">{rank}</span>}
      </span>
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
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isMe ? 'text-indigo-700' : 'text-slate-900'}`}>
          {isMe ? 'You' : (entry.name ?? 'Unknown')}
        </p>
        <p className="text-xs text-slate-400">
          Best: {entry.longestStreak} days · {entry.totalCompletions} chores total
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-slate-900">
          {entry.currentStreak > 0 ? `🔥 ${entry.currentStreak}` : '—'}
        </p>
        <p className="text-[10px] text-slate-400">day{entry.currentStreak !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

function EmptyBadges() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <span className="text-5xl">🌟</span>
      <h3 className="mt-4 font-semibold text-slate-900">No badges yet</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        Complete chores to earn your first badge. Check the <strong>All Achievements</strong> tab to see what&apos;s available.
      </p>
    </div>
  )
}
