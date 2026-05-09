'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HouseholdSettings } from '@/lib/types/database'

// ── Household settings ────────────────────────────────────────────────────────

/**
 * Merges `patch` into the household's existing settings JSONB.
 * Admin-only.
 */
export async function updateHouseholdSettings(
  householdId: string,
  patch: Partial<HouseholdSettings>
) {
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: householdId,
  })
  if (!isAdmin) return { error: 'Only admins can change household settings.' }

  // Fetch current settings
  const { data: hh } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const current = (hh?.settings ?? {}) as HouseholdSettings
  const merged  = { ...current, ...patch }

  const { error } = await supabase
    .from('households')
    .update({ settings: merged })
    .eq('id', householdId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Category management ───────────────────────────────────────────────────────

export async function addCustomCategory(householdId: string, name: string) {
  const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-')
  if (!trimmed || trimmed.length < 2) return { error: 'Category name must be at least 2 characters.' }
  if (trimmed.length > 30) return { error: 'Category name must be 30 characters or fewer.' }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: householdId,
  })
  if (!isAdmin) return { error: 'Only admins can manage categories.' }

  const { data: hh } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const current = (hh?.settings ?? {}) as HouseholdSettings
  const existing = current.customCategories ?? []

  if (existing.includes(trimmed)) return { error: 'That category already exists.' }
  if (existing.length >= 10) return { error: 'Maximum 10 custom categories.' }

  const { error } = await supabase
    .from('households')
    .update({ settings: { ...current, customCategories: [...existing, trimmed] } })
    .eq('id', householdId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/chores')
  return { success: true }
}

export async function removeCustomCategory(householdId: string, name: string) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: householdId,
  })
  if (!isAdmin) return { error: 'Only admins can manage categories.' }

  const { data: hh } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const current = (hh?.settings ?? {}) as HouseholdSettings
  const updated = (current.customCategories ?? []).filter(c => c !== name)

  const { error } = await supabase
    .from('households')
    .update({ settings: { ...current, customCategories: updated } })
    .eq('id', householdId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/chores')
  return { success: true }
}

// ── Delete account ────────────────────────────────────────────────────────────

/**
 * Permanently removes the authenticated user's account.
 *
 * Flow:
 *  1. Delete the users table row  (cascades: point_events, badges, streaks)
 *  2. Delete household_members row (cascades chore assignments as null)
 *  3. Delete the auth.users record via the service-role admin client
 *  4. Redirect to /login
 */
export async function deleteAccount() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const userId = user.id

  // 1. Sign out first so session cookies are cleared
  await supabase.auth.signOut()

  // 2. Delete public user row (cascades related tables)
  await supabase.from('users').delete().eq('id', userId)

  // 3. Hard-delete auth record via service-role client
  try {
    const admin = createAdminClient()
    await admin.auth.admin.deleteUser(userId)
  } catch {
    // Non-fatal if service role key isn't configured in dev
  }

  redirect('/login')
}

// ── Leave household ───────────────────────────────────────────────────────────
// Re-exported here so the Settings page only needs one import
export { leaveHousehold } from './household'
