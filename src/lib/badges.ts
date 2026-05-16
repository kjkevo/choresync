/**
 * Badge & streak logic — NOT a server action file.
 * Called from within server actions that already hold a Supabase client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'


export type BadgeType =
  | 'first_chore'
  | 'chores_10'
  | 'chores_100'
  | 'streak_7'
  | 'streak_30'
  | 'top_contributor'

export const ALL_BADGE_TYPES: BadgeType[] = [
  'first_chore',
  'chores_10',
  'chores_100',
  'streak_7',
  'streak_30',
  'top_contributor',
]

export type BadgeRarity = 'common' | 'rare' | 'epic'

export interface BadgeMeta {
  emoji:    string
  label:    string
  desc:     string
  rarity:   BadgeRarity
  repeatable: boolean   // whether it can be earned more than once (e.g. top_contributor)
}

export const BADGE_META: Record<BadgeType, BadgeMeta> = {
  first_chore:     { emoji: '🌟', label: 'First Step',       desc: 'Completed your very first chore',                     rarity: 'common', repeatable: false },
  chores_10:       { emoji: '✅', label: 'Getting Started',   desc: 'Completed 10 chores in this household',               rarity: 'common', repeatable: false },
  chores_100:      { emoji: '💯', label: 'Century Club',      desc: 'Completed 100 chores — absolute legend',              rarity: 'epic',   repeatable: false },
  streak_7:        { emoji: '🔥', label: 'On Fire',           desc: '7 consecutive days with at least one chore completed', rarity: 'rare',   repeatable: false },
  streak_30:       { emoji: '⚡', label: 'Unstoppable',       desc: '30-day completion streak',                             rarity: 'epic',   repeatable: false },
  top_contributor: { emoji: '👑', label: 'Top Contributor',   desc: 'Most points in the household this month',             rarity: 'rare',   repeatable: true  },
}

// Using SupabaseClient<any> to stay compatible with both the old 3-param
// return type from @supabase/ssr and the new 5-param SupabaseClient in
// @supabase/supabase-js v2.105+.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any>

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Called after every successful chore completion.
 * Updates the user's streak record and awards any newly-earned badges.
 * Returns the list of newly-awarded badge types (may be empty).
 */
export async function updateStreakAndCheckBadges(
  supabase: Supabase,
  userId:      string,
  householdId: string,
): Promise<BadgeType[]> {
  const today = new Date().toISOString().split('T')[0]

  // 1. Update streak + get updated totals
  const { currentStreak, totalCompletions } = await upsertStreak(supabase, userId, householdId, today)

  // 2. Load existing badges to avoid duplicates
  const { data: existingBadges } = await supabase
    .from('badges')
    .select('badge_type, earned_at')
    .eq('user_id',      userId)
    .eq('household_id', householdId)

  const earnedSet = new Set((existingBadges ?? []).map(b => b.badge_type as BadgeType))
  const toAward: BadgeType[] = []

  // 3. One-time milestone badges
  if (!earnedSet.has('first_chore') && totalCompletions === 1) toAward.push('first_chore')
  if (!earnedSet.has('chores_10')   && totalCompletions >= 10) toAward.push('chores_10')
  if (!earnedSet.has('chores_100')  && totalCompletions >= 100) toAward.push('chores_100')

  // 4. Streak badges
  if (!earnedSet.has('streak_7')  && currentStreak >= 7)  toAward.push('streak_7')
  if (!earnedSet.has('streak_30') && currentStreak >= 30) toAward.push('streak_30')

  // 5. Monthly top contributor (re-awardable once per calendar month)
  const monthStart = startOfMonth()
  const alreadyThisMonth = (existingBadges ?? []).some(
    b => b.badge_type === 'top_contributor' && b.earned_at >= monthStart,
  )
  if (!alreadyThisMonth) {
    const isTop = await checkTopContributor(supabase, userId, householdId, monthStart)
    if (isTop) toAward.push('top_contributor')
  }

  // 6. Persist new badges
  if (toAward.length > 0) {
    await supabase.from('badges').insert(
      toAward.map(badge_type => ({ user_id: userId, household_id: householdId, badge_type })),
    )
  }

  return toAward
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function upsertStreak(
  supabase:    Supabase,
  userId:      string,
  householdId: string,
  today:       string,
): Promise<{ currentStreak: number; totalCompletions: number }> {
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_active_date, total_completions')
    .eq('user_id',      userId)
    .eq('household_id', householdId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (!existing) {
    await supabase.from('user_streaks').insert({
      user_id:           userId,
      household_id:      householdId,
      current_streak:    1,
      longest_streak:    1,
      last_active_date:  today,
      total_completions: 1,
      updated_at:        now,
    })
    return { currentStreak: 1, totalCompletions: 1 }
  }

  const newTotal = existing.total_completions + 1

  // If already active today, only bump total_completions — streak is unchanged
  if (existing.last_active_date === today) {
    await supabase
      .from('user_streaks')
      .update({ total_completions: newTotal, updated_at: now })
      .eq('user_id',      userId)
      .eq('household_id', householdId)
    return { currentStreak: existing.current_streak, totalCompletions: newTotal }
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = yesterday.toISOString().split('T')[0]

  const newStreak  = existing.last_active_date === yesterdayIso ? existing.current_streak + 1 : 1
  const newLongest = Math.max(existing.longest_streak, newStreak)

  await supabase
    .from('user_streaks')
    .update({
      current_streak:    newStreak,
      longest_streak:    newLongest,
      last_active_date:  today,
      total_completions: newTotal,
      updated_at:        now,
    })
    .eq('user_id',      userId)
    .eq('household_id', householdId)

  return { currentStreak: newStreak, totalCompletions: newTotal }
}

async function checkTopContributor(
  supabase:      Supabase,
  userId:        string,
  householdId:   string,
  monthStartIso: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from('point_events')
    .select('user_id, points')
    .eq('household_id', householdId)
    .gte('earned_at',   monthStartIso)

  if (!rows || rows.length === 0) return false

  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points)

  let topUser = ''
  let topPts  = 0
  for (const [uid, pts] of totals) {
    if (pts > topPts) { topPts = pts; topUser = uid }
  }
  return topUser === userId && topPts > 0
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
