'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { BADGE_META, ALL_BADGE_TYPES, type BadgeType } from '@/lib/badges'
import type { BadgeRow, UserRow, RewardsCatalogRow, RedemptionRow } from '@/lib/types/database'
import {
  createReward,
  updateReward,
  deleteReward,
  redeemReward,
  resolveRedemption,
  toggleLeaderboard,
} from '@/lib/actions/rewards'

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

interface LeaderboardEntry {
  userId:         string
  name:           string | null
  avatarUrl:      string | null
  color:          string
  pointsThisWeek: number
  pointsAllTime:  number
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
  rewardsCatalog:      RewardsCatalogRow[]
  redemptions:         RedemptionRow[]
  leaderboard:         LeaderboardEntry[]
  leaderboardHidden:   boolean
  isAdmin:             boolean
  householdId:         string
}

type TabKey = 'my-badges' | 'achievements' | 'shop' | 'leaderboard'

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl
      ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {message}
    </div>
  )
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
  rewardsCatalog,
  redemptions,
  leaderboard,
  leaderboardHidden,
  isAdmin,
  householdId,
}: RewardsClientProps) {
  const [tab, setTab] = useState<TabKey>('my-badges')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const earnedTypes = new Set(myBadges.map(b => b.badge_type as BadgeType))
  const streak      = myStreak?.current_streak    ?? 0
  const bestStreak  = myStreak?.longest_streak    ?? 0
  const totalChores = myStreak?.total_completions ?? 0

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)' }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

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
        <div className="mb-4 flex rounded-2xl bg-white p-1 shadow-sm border border-slate-100 overflow-x-auto">
          {([
            { key: 'my-badges',    label: `My Badges (${myBadges.length})` },
            { key: 'achievements', label: 'All Achievements'                },
            { key: 'shop',         label: '🛍️ Shop'                        },
            { key: 'leaderboard',  label: '🏆 Leaderboard'                 },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 min-w-max rounded-xl py-2.5 px-2 text-xs font-semibold transition
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

        {/* ── Tab: Shop ───────────────────────────────────────────────────── */}
        {tab === 'shop' && (
          <ShopTab
            currentUserId={currentUserId}
            totalPoints={totalPoints}
            rewardsCatalog={rewardsCatalog}
            redemptions={redemptions}
            profileMap={profileMap}
            colorMap={colorMap}
            isAdmin={isAdmin}
            householdId={householdId}
            onToast={showToast}
          />
        )}

        {/* ── Tab: Leaderboard ────────────────────────────────────────────── */}
        {tab === 'leaderboard' && (
          <LeaderboardTab
            leaderboard={leaderboard}
            householdStreaks={householdStreaks}
            allHouseholdBadges={allHouseholdBadges}
            currentUserId={currentUserId}
            colorMap={colorMap}
            profileMap={profileMap}
            leaderboardHidden={leaderboardHidden}
            isAdmin={isAdmin}
            householdId={householdId}
            onToast={showToast}
          />
        )}
      </div>
    </div>
  )
}

// ── Shop Tab ──────────────────────────────────────────────────────────────────

function ShopTab({
  currentUserId,
  totalPoints,
  rewardsCatalog,
  redemptions,
  profileMap,
  colorMap,
  isAdmin,
  householdId,
  onToast,
}: {
  currentUserId:  string
  totalPoints:    number
  rewardsCatalog: RewardsCatalogRow[]
  redemptions:    RedemptionRow[]
  profileMap:     Record<string, UserRow>
  colorMap:       Record<string, string>
  isAdmin:        boolean
  householdId:    string
  onToast:        (msg: string, type: 'success' | 'error') => void
}) {
  const [showAddForm, setShowAddForm]       = useState(false)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [isPending, startTransition]        = useTransition()
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null)
  const addFormRef                          = useRef<HTMLFormElement>(null)

  const myRedemptions   = redemptions.filter(r => r.user_id === currentUserId)
  const allRedemptions  = redemptions // admin sees all

  function handleCreateReward(formData: FormData) {
    formData.set('household_id', householdId)
    startTransition(async () => {
      const result = await createReward(formData)
      if (result?.error) { onToast(result.error, 'error'); return }
      onToast('Reward created!', 'success')
      setShowAddForm(false)
      addFormRef.current?.reset()
    })
  }

  function handleUpdateReward(rewardId: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateReward(rewardId, formData)
      if (result?.error) { onToast(result.error, 'error'); return }
      onToast('Reward updated!', 'success')
      setEditingId(null)
    })
  }

  function handleDeleteReward(rewardId: string) {
    startTransition(async () => {
      const result = await deleteReward(rewardId)
      if (result?.error) { onToast(result.error, 'error'); return }
      onToast('Reward removed.', 'success')
      setConfirmDelete(null)
    })
  }

  function handleRedeem(rewardId: string) {
    startTransition(async () => {
      const result = await redeemReward(rewardId)
      if (result?.error) { onToast(result.error, 'error'); return }
      onToast('Redemption requested! Waiting for admin approval.', 'success')
    })
  }

  function handleResolve(redemptionId: string, status: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await resolveRedemption(redemptionId, status)
      if (result?.error) { onToast(result.error, 'error'); return }
      onToast(status === 'approved' ? 'Redemption approved!' : 'Redemption rejected.', 'success')
    })
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">⏳ Pending</span>
      case 'approved': return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✅ Approved</span>
      case 'rejected': return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">❌ Rejected</span>
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      {/* My balance */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white text-center shadow-lg">
        <p className="text-sm font-medium text-indigo-200">Your Balance</p>
        <p className="mt-1 text-4xl font-bold">🏆 {totalPoints}</p>
        <p className="mt-1 text-xs text-indigo-300">points available</p>
      </div>

      {/* Admin: add reward */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Manage Rewards</h2>
            <button
              type="button"
              onClick={() => setShowAddForm(v => !v)}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              {showAddForm ? 'Cancel' : '+ Add Reward'}
            </button>
          </div>

          {showAddForm && (
            <form ref={addFormRef} action={handleCreateReward} className="space-y-3 px-4 py-4 border-b border-slate-100">
              <div className="flex gap-2">
                <div className="w-16">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Emoji</label>
                  <input name="emoji" defaultValue="🎁" className="w-full rounded-xl border border-slate-200 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input name="name" required placeholder="Extra screen time…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                <input name="description" placeholder="What does this reward get you?" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Points cost</label>
                <input name="points_cost" type="number" min="1" defaultValue="50" required className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {isPending ? 'Creating…' : 'Create Reward'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Rewards grid */}
      {rewardsCatalog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <span className="text-4xl">🛍️</span>
          <p className="mt-3 text-sm text-slate-400">No rewards available yet.{isAdmin ? ' Add one above!' : ' Ask an admin to add some!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rewardsCatalog.map(reward => (
            <div key={reward.id}>
              {editingId === reward.id ? (
                // Edit form
                <form
                  action={(fd) => handleUpdateReward(reward.id, fd)}
                  className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex gap-2">
                    <input name="emoji" defaultValue={reward.emoji} className="w-16 rounded-xl border border-slate-200 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input name="name" defaultValue={reward.name} required className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <input name="description" defaultValue={reward.description ?? ''} placeholder="Description" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <input name="points_cost" type="number" min="1" defaultValue={reward.points_cost} required className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none">{reward.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{reward.name}</p>
                      {reward.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{reward.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-indigo-600">🏆 {reward.points_cost}</p>
                      <p className="text-[10px] text-slate-400">points</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      disabled={isPending || totalPoints < reward.points_cost}
                      onClick={() => handleRedeem(reward.id)}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition
                        ${totalPoints >= reward.points_cost
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        } disabled:opacity-60`}
                    >
                      {totalPoints >= reward.points_cost ? 'Redeem' : `Need ${reward.points_cost - totalPoints} more`}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(reward.id)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Edit
                        </button>
                        {confirmDelete === reward.id ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeleteReward(reward.id)}
                              className="rounded-xl bg-rose-600 px-2 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(reward.id)}
                            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Redemptions section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">
            {isAdmin ? 'All Redemptions' : 'My Redemptions'}
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {(isAdmin ? allRedemptions : myRedemptions).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No redemptions yet.</p>
          ) : (
            (isAdmin ? allRedemptions : myRedemptions).map(r => {
              const requester = profileMap[r.user_id]
              const color     = colorMap[r.user_id] ?? '#6366f1'
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  {isAdmin && (
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      {requester?.avatar_url ? (
                        <Image src={requester.avatar_url} alt={requester.full_name ?? ''} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        memberInitials(requester?.full_name ?? null)
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base">{r.reward_emoji}</span>
                      <p className="text-sm font-semibold text-slate-900 truncate">{r.reward_name}</p>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAdmin && (requester?.full_name ?? 'Unknown') + ' · '}
                      🏆 {r.points_spent} pts · {formatDate(r.redeemed_at)}
                    </p>
                  </div>
                  {isAdmin && r.status === 'pending' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleResolve(r.id, 'approved')}
                        className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleResolve(r.id, 'rejected')}
                        className="rounded-xl border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Leaderboard Tab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  leaderboard,
  householdStreaks,
  allHouseholdBadges,
  currentUserId,
  colorMap,
  profileMap,
  leaderboardHidden,
  isAdmin,
  householdId,
  onToast,
}: {
  leaderboard:        LeaderboardEntry[]
  householdStreaks:    HouseholdStreakEntry[]
  allHouseholdBadges: { user_id: string; badge_type: string; earned_at: string }[]
  currentUserId:      string
  colorMap:           Record<string, string>
  profileMap:         Record<string, UserRow>
  leaderboardHidden:  boolean
  isAdmin:            boolean
  householdId:        string
  onToast:            (msg: string, type: 'success' | 'error') => void
}) {
  const [isPending, startTransition] = useTransition()
  const [hiddenState, setHiddenState] = useState(leaderboardHidden)

  function handleToggle() {
    const newHidden = !hiddenState
    setHiddenState(newHidden)
    startTransition(async () => {
      const result = await toggleLeaderboard(householdId, newHidden)
      if (result?.error) {
        setHiddenState(!newHidden) // revert
        onToast(result.error, 'error')
        return
      }
      onToast(newHidden ? 'Leaderboard hidden from members.' : 'Leaderboard is now visible.', 'success')
    })
  }

  const showLeaderboard = isAdmin || !hiddenState

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      {/* Admin toggle */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Leaderboard visibility</p>
            <p className="text-xs text-slate-400">{hiddenState ? 'Hidden from members' : 'Visible to all members'}</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
              ${hiddenState ? 'bg-slate-200' : 'bg-indigo-600'} disabled:opacity-60`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out
                ${hiddenState ? 'translate-x-0' : 'translate-x-5'}`}
            />
          </button>
        </div>
      )}

      {/* Weekly points leaderboard */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">⭐ This Week&apos;s Points</h2>
          <p className="text-xs text-slate-400">Points earned Monday – Sunday (does not include spending)</p>
        </div>

        {!showLeaderboard ? (
          <div className="px-4 py-10 text-center">
            <span className="text-4xl">🔒</span>
            <p className="mt-3 text-sm text-slate-400">Leaderboard is hidden by your household admin.</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No points earned yet this week.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {leaderboard.map((entry, idx) => {
              const isMe = entry.userId === currentUserId
              return (
                <div key={entry.userId} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-indigo-50/60' : ''}`}>
                  <span className="w-6 text-center text-sm">
                    {idx < 3 ? medals[idx] : <span className="font-semibold text-slate-400">{idx + 1}</span>}
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
                    <p className="text-xs text-slate-400">All-time: {entry.pointsAllTime} pts</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900">🏆 {entry.pointsThisWeek}</p>
                    <p className="text-[10px] text-slate-400">this week</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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

      {/* Household badges feed */}
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
