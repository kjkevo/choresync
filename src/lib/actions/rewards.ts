'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { HouseholdSettings } from '@/lib/types/database'

// ── Create reward (admin only) ────────────────────────────────────────────────

export async function createReward(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const householdId = formData.get('household_id') as string
  if (!householdId) return { error: 'Missing household.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: householdId })
  if (!isAdmin) return { error: 'Only admins can create rewards.' }

  const name        = (formData.get('name') as string | null)?.trim()
  const emoji       = (formData.get('emoji') as string | null)?.trim() || '🎁'
  const description = (formData.get('description') as string | null)?.trim() || null
  const pointsCostRaw = formData.get('points_cost') as string | null
  const points_cost = pointsCostRaw ? parseInt(pointsCostRaw, 10) : 50

  if (!name || name.length < 1) return { error: 'Reward name is required.' }
  if (name.length > 120)        return { error: 'Name must be 120 characters or fewer.' }
  if (isNaN(points_cost) || points_cost < 1) return { error: 'Points cost must be at least 1.' }

  const { error: dbErr } = await supabase.from('rewards_catalog').insert({
    household_id: householdId,
    name,
    emoji,
    description,
    points_cost,
    created_by: user.id,
  })

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/rewards')
  return { success: true }
}

// ── Update reward (admin only) ────────────────────────────────────────────────

export async function updateReward(rewardId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: reward } = await supabase
    .from('rewards_catalog')
    .select('household_id')
    .eq('id', rewardId)
    .maybeSingle()

  if (!reward) return { error: 'Reward not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: reward.household_id })
  if (!isAdmin) return { error: 'Only admins can update rewards.' }

  const name        = (formData.get('name') as string | null)?.trim()
  const emoji       = (formData.get('emoji') as string | null)?.trim() || '🎁'
  const description = (formData.get('description') as string | null)?.trim() || null
  const pointsCostRaw = formData.get('points_cost') as string | null
  const points_cost = pointsCostRaw ? parseInt(pointsCostRaw, 10) : 50

  if (!name || name.length < 1) return { error: 'Reward name is required.' }
  if (isNaN(points_cost) || points_cost < 1) return { error: 'Points cost must be at least 1.' }

  const { error: dbErr } = await supabase
    .from('rewards_catalog')
    .update({ name, emoji, description, points_cost })
    .eq('id', rewardId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/rewards')
  return { success: true }
}

// ── Delete reward — soft-delete by setting is_active=false (admin only) ───────

export async function deleteReward(rewardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: reward } = await supabase
    .from('rewards_catalog')
    .select('household_id')
    .eq('id', rewardId)
    .maybeSingle()

  if (!reward) return { error: 'Reward not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: reward.household_id })
  if (!isAdmin) return { error: 'Only admins can delete rewards.' }

  const { error: dbErr } = await supabase
    .from('rewards_catalog')
    .update({ is_active: false })
    .eq('id', rewardId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/rewards')
  return { success: true }
}

// ── Redeem reward (member action) ─────────────────────────────────────────────

export async function redeemReward(rewardId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Load membership
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { error: 'You are not a member of any household.' }
  const { household_id: householdId } = membership

  // Load the reward (must be active + in the user's household)
  const { data: reward } = await supabase
    .from('rewards_catalog')
    .select('id, name, emoji, points_cost, household_id, is_active')
    .eq('id', rewardId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!reward)           return { error: 'Reward not found.' }
  if (!reward.is_active) return { error: 'This reward is no longer available.' }

  // Compute current point balance
  const { data: pointRows } = await supabase
    .from('point_events')
    .select('points')
    .eq('user_id', user.id)
    .eq('household_id', householdId)

  const balance = ((pointRows ?? []) as { points: number }[]).reduce((s, r) => s + r.points, 0)

  if (balance < reward.points_cost) {
    return { error: `Not enough points. You have ${balance} but need ${reward.points_cost}.` }
  }

  const now = new Date().toISOString()

  // Insert negative point event
  const { error: pointErr } = await supabase.from('point_events').insert({
    user_id:      user.id,
    household_id: householdId,
    chore_id:     null,
    chore_name:   `Redeemed: ${reward.name}`,
    points:       -reward.points_cost,
    earned_at:    now,
  })

  if (pointErr) return { error: pointErr.message }

  // Insert redemption record
  const { error: redemptionErr } = await supabase.from('redemptions').insert({
    user_id:      user.id,
    household_id: householdId,
    reward_id:    reward.id,
    reward_name:  reward.name,
    reward_emoji: reward.emoji,
    points_spent: reward.points_cost,
    status:       'pending',
    redeemed_at:  now,
  })

  if (redemptionErr) return { error: redemptionErr.message }

  revalidatePath('/rewards')
  return { success: true }
}

// ── Resolve redemption — approve or reject (admin only) ───────────────────────

export async function resolveRedemption(redemptionId: string, status: 'approved' | 'rejected') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: redemption } = await supabase
    .from('redemptions')
    .select('id, user_id, household_id, points_spent, status, reward_name')
    .eq('id', redemptionId)
    .maybeSingle()

  if (!redemption) return { error: 'Redemption not found.' }
  if (redemption.status !== 'pending') return { error: 'Redemption is already resolved.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: redemption.household_id })
  if (!isAdmin) return { error: 'Only admins can approve or reject redemptions.' }

  const now = new Date().toISOString()

  // If rejected, reverse the point deduction
  if (status === 'rejected') {
    const { error: pointErr } = await supabase.from('point_events').insert({
      user_id:      redemption.user_id,
      household_id: redemption.household_id,
      chore_id:     null,
      chore_name:   `Refund: ${redemption.reward_name}`,
      points:       redemption.points_spent,
      earned_at:    now,
    })
    if (pointErr) return { error: pointErr.message }
  }

  // Update redemption status
  const { error: dbErr } = await supabase
    .from('redemptions')
    .update({ status, resolved_at: now, resolved_by: user.id })
    .eq('id', redemptionId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/rewards')
  return { success: true }
}

// ── Toggle leaderboard visibility (admin only) ────────────────────────────────

export async function toggleLeaderboard(householdId: string, hidden: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: householdId })
  if (!isAdmin) return { error: 'Only admins can change leaderboard settings.' }

  // Fetch current settings
  const { data: household } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const currentSettings = (household?.settings ?? {}) as HouseholdSettings
  const newSettings: HouseholdSettings = { ...currentSettings, leaderboardHidden: hidden }

  const { error: dbErr } = await supabase
    .from('households')
    .update({ settings: newSettings as unknown as import('@/lib/types/database').Json })
    .eq('id', householdId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/rewards')
  return { success: true }
}
