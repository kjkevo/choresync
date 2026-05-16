'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Send a swap request ───────────────────────────────────────────────────────
// Caller must be the current assignee. Requestee must be in the household
// (and in rotation_members if rotation is enabled).

export async function sendSwapRequest(choreId: string, requesteeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: chore } = await supabase
    .from('chores')
    .select('household_id, assigned_to, rotation_enabled, rotation_members')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }
  if (chore.assigned_to !== user.id) {
    return { error: 'You can only request a swap for chores currently assigned to you.' }
  }

  // Verify requestee is a household member
  const { data: requesteeMember } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('user_id', requesteeId)
    .eq('household_id', chore.household_id)
    .maybeSingle()

  if (!requesteeMember) return { error: 'That member is not in your household.' }

  // For rotation chores, requestee must be in the rotation
  if (chore.rotation_enabled) {
    const members = (chore.rotation_members ?? []) as string[]
    if (!members.includes(requesteeId)) {
      return { error: 'That member is not part of this chore\'s rotation.' }
    }
  }

  // Cancel any existing pending request the requester already sent for this chore
  await supabase
    .from('swap_requests')
    .update({ status: 'declined' })
    .eq('chore_id', choreId)
    .eq('requester_id', user.id)
    .eq('status', 'pending')

  const { error: dbErr } = await supabase
    .from('swap_requests')
    .insert({
      chore_id:     choreId,
      household_id: chore.household_id,
      requester_id: user.id,
      requestee_id: requesteeId,
    })

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  return { success: true }
}

// ── Respond to a swap request ─────────────────────────────────────────────────
// Only the requestee may accept or decline.
// On accept: chore is reassigned to the requestee; rotation_index advances to match.

export async function respondToSwap(swapId: string, accept: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Fetch swap request without a join (Relationships not defined in hand-written types)
  const { data: swapRaw } = await supabase
    .from('swap_requests')
    .select('*')
    .eq('id', swapId)
    .maybeSingle()

  if (!swapRaw) return { error: 'Swap request not found.' }
  if (swapRaw.requestee_id !== user.id) return { error: 'Not authorised.' }
  if (swapRaw.status !== 'pending') return { error: 'This request is no longer pending.' }

  const swap = swapRaw

  if (!accept) {
    const { error } = await supabase
      .from('swap_requests')
      .update({ status: 'declined' })
      .eq('id', swapId)
    if (error) return { error: error.message }
    revalidatePath('/chores')
    return { success: true }
  }

  // Accept: fetch chore details separately, then reassign to requestee (current user)
  const { data: chore } = await supabase
    .from('chores')
    .select('household_id, assigned_to, rotation_enabled, rotation_members, rotation_index')
    .eq('id', swap.chore_id)
    .maybeSingle()

  if (!chore) return { error: 'Chore no longer exists.' }

  const updatePayload: { assigned_to: string; rotation_index?: number } = { assigned_to: user.id }

  if (chore.rotation_enabled) {
    const members = (chore.rotation_members ?? []) as string[]
    const newIdx = members.indexOf(user.id)
    if (newIdx >= 0) updatePayload.rotation_index = newIdx
  }

  const { error: choreErr } = await supabase
    .from('chores')
    .update(updatePayload)
    .eq('id', swap.chore_id)

  if (choreErr) return { error: choreErr.message }

  // Mark this request accepted, decline all others for the same chore
  await supabase.from('swap_requests').update({ status: 'accepted' }).eq('id', swapId)
  await supabase
    .from('swap_requests')
    .update({ status: 'declined' })
    .eq('chore_id', swap.chore_id)
    .eq('status', 'pending')
    .neq('id', swapId)

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Manual override (admin only) ──────────────────────────────────────────────
// Reassigns a chore to any household member and syncs rotation_index.

export async function manualOverride(choreId: string, newUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: chore } = await supabase
    .from('chores')
    .select('household_id, rotation_enabled, rotation_members')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: chore.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can manually reassign chores.' }

  const updatePayload: { assigned_to: string; rotation_index?: number } = { assigned_to: newUserId }

  if (chore.rotation_enabled) {
    const members = (chore.rotation_members ?? []) as string[]
    const newIdx = members.indexOf(newUserId)
    if (newIdx >= 0) updatePayload.rotation_index = newIdx
  }

  const { error: dbErr } = await supabase
    .from('chores')
    .update(updatePayload)
    .eq('id', choreId)

  if (dbErr) return { error: dbErr.message }

  // Decline any pending swap requests — override supersedes them
  await supabase
    .from('swap_requests')
    .update({ status: 'declined' })
    .eq('chore_id', choreId)
    .eq('status', 'pending')

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}
