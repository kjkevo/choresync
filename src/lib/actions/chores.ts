'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ChoreCategory, ChoreFrequency, ChorePriority } from '@/lib/types/database'
import { updateStreakAndCheckBadges } from '@/lib/badges'

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_FREQUENCIES: ChoreFrequency[] = ['one-time', 'daily', 'weekly', 'biweekly', 'monthly']
const VALID_PRIORITIES:  ChorePriority[]  = ['low', 'medium', 'high']
const VALID_CATEGORIES:  ChoreCategory[]  = ['kitchen', 'bathroom', 'bedroom', 'outdoor', 'laundry', 'general']

// ── Form parsing ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCustomCategories(supabase: any, householdId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('households')
      .select('settings')
      .eq('id', householdId)
      .maybeSingle()
    return ((data?.settings as { customCategories?: string[] } | null)?.customCategories) ?? []
  } catch { return [] }
}

function parseChoreForm(formData: FormData, allowedCustomCategories: string[] = []) {
  const name           = (formData.get('name') as string).trim()
  const description    = (formData.get('description') as string | null)?.trim() || null
  const assigned_to    = (formData.get('assigned_to') as string | null) || null
  const due_date       = (formData.get('due_date') as string | null) || null
  const frequency      = (formData.get('frequency') as ChoreFrequency) || 'one-time'
  const priority       = (formData.get('priority') as ChorePriority)   || 'medium'
  const category       = (formData.get('category') as ChoreCategory)   || 'general'
  const estRaw         = formData.get('estimated_mins') as string | null
  const estimated_mins = estRaw ? parseInt(estRaw, 10) : null
  const pointsRaw      = formData.get('points') as string | null
  const points         = pointsRaw ? Math.max(0, Math.min(100, parseInt(pointsRaw, 10) || 0)) : 0

  // Rotation fields
  const rotation_enabled = formData.get('rotation_enabled') === 'true'
  let rotation_members: string[] = []
  try {
    const raw = formData.get('rotation_members') as string | null
    const parsed = raw ? JSON.parse(raw) : []
    rotation_members = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch { rotation_members = [] }

  if (!name || name.length < 1)   return { error: 'Chore name is required.' }
  if (name.length > 120)          return { error: 'Name must be 120 characters or fewer.' }
  if (!VALID_FREQUENCIES.includes(frequency)) return { error: 'Invalid frequency.' }
  if (!VALID_PRIORITIES.includes(priority))   return { error: 'Invalid priority.' }
  // Accept built-in OR custom categories
  const allValidCategories = [...VALID_CATEGORIES, ...allowedCustomCategories]
  if (!allValidCategories.includes(category as string)) return { error: 'Invalid category.' }
  if (estimated_mins !== null && (isNaN(estimated_mins) || estimated_mins < 1 || estimated_mins > 480)) {
    return { error: 'Estimated time must be between 1 and 480 minutes.' }
  }
  if (rotation_enabled && frequency === 'one-time') {
    return { error: 'Rotation requires a recurring frequency (daily, weekly, etc.).' }
  }
  if (rotation_enabled && rotation_members.length < 2) {
    return { error: 'Rotation requires at least 2 members.' }
  }

  return {
    data: {
      name, description, assigned_to, due_date, frequency, priority, category,
      estimated_mins, points, rotation_enabled, rotation_members,
    },
  }
}

function advanceDueDate(dueDateIso: string | null, frequency: ChoreFrequency): string {
  const base = dueDateIso ? new Date(dueDateIso) : new Date()
  const d = new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  switch (frequency) {
    case 'daily':    d.setDate(d.getDate() + 1);   break
    case 'weekly':   d.setDate(d.getDate() + 7);   break
    case 'biweekly': d.setDate(d.getDate() + 14);  break
    case 'monthly':  d.setMonth(d.getMonth() + 1); break
    default:         break
  }
  return d.toISOString().split('T')[0]
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createChore(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const householdId = formData.get('household_id') as string
  if (!householdId) return { error: 'Missing household.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: householdId })
  if (!isAdmin) return { error: 'Only admins can create chores.' }

  const customCats = await fetchCustomCategories(supabase, householdId)
  const parsed = parseChoreForm(formData, customCats)
  if ('error' in parsed) return parsed

  const { rotation_enabled, rotation_members, ...rest } = parsed.data

  // For rotation chores, pin assigned_to to the first member in the rotation
  const assigned_to = rotation_enabled ? rotation_members[0] : rest.assigned_to

  const { data: chore, error: dbErr } = await supabase
    .from('chores')
    .insert({
      household_id:     householdId,
      created_by:       user.id,
      ...rest,
      assigned_to,
      rotation_enabled,
      rotation_members,
      rotation_index:   0,
    })
    .select()
    .single()

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true, chore }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateChore(choreId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: existing } = await supabase
    .from('chores')
    .select('household_id, assigned_to, rotation_index')
    .eq('id', choreId)
    .maybeSingle()

  if (!existing) return { error: 'Chore not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: existing.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can edit chores.' }

  const customCats = await fetchCustomCategories(supabase, existing.household_id)
  const parsed = parseChoreForm(formData, customCats)
  if ('error' in parsed) return parsed

  const { rotation_enabled, rotation_members, ...rest } = parsed.data

  let rotation_index = 0
  let assigned_to = rest.assigned_to

  if (rotation_enabled) {
    // Preserve the existing assignee's position in the new rotation order if possible
    const currentAssignee = existing.assigned_to
    const newIdx = currentAssignee ? rotation_members.indexOf(currentAssignee) : -1
    rotation_index = newIdx >= 0 ? newIdx : 0
    assigned_to = rotation_members[rotation_index]
  }

  const { error: dbErr } = await supabase
    .from('chores')
    .update({
      ...rest,
      assigned_to,
      rotation_enabled,
      rotation_members: rotation_enabled ? rotation_members : [],
      rotation_index,
    })
    .eq('id', choreId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteChore(choreId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: chore } = await supabase
    .from('chores')
    .select('household_id')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: chore.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can delete chores.' }

  const { error: dbErr } = await supabase.from('chores').delete().eq('id', choreId)
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Complete ──────────────────────────────────────────────────────────────────

export async function completeChore(choreId: string, photoProofUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: chore } = await supabase
    .from('chores')
    .select('household_id, name, category, priority, frequency, due_date, status, rotation_enabled, rotation_members, rotation_index, points')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }
  if (chore.status === 'completed') return { error: 'Chore is already completed.' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('household_id', chore.household_id)
    .maybeSingle()

  if (!membership) return { error: 'You are not a member of this household.' }

  const now = new Date().toISOString()
  const rotationMembers = (chore.rotation_members ?? []) as string[]
  const isRotating = chore.rotation_enabled && rotationMembers.length > 0

  // Compute next rotation slot (used for recurring chores)
  const nextRotationIndex = isRotating
    ? (chore.rotation_index + 1) % rotationMembers.length
    : chore.rotation_index
  const nextAssignee = isRotating ? rotationMembers[nextRotationIndex] : undefined

  if (chore.frequency === 'one-time') {
    const { error: dbErr } = await supabase
      .from('chores')
      .update({
        status:          'completed',
        completed_at:    now,
        completed_by:    user.id,
        photo_proof_url: photoProofUrl ?? null,
      })
      .eq('id', choreId)
    if (dbErr) return { error: dbErr.message }
  } else {
    const nextDue = advanceDueDate(chore.due_date, chore.frequency)
    const { error: dbErr } = await supabase
      .from('chores')
      .update({
        status:            'incomplete',
        due_date:          nextDue,
        last_completed_at: now,
        photo_proof_url:   null,
        completed_at:      null,
        completed_by:      null,
        // Advance rotation
        ...(isRotating ? { rotation_index: nextRotationIndex, assigned_to: nextAssignee } : {}),
      })
      .eq('id', choreId)
    if (dbErr) return { error: dbErr.message }
  }

  // ── Write immutable completion log entry ────────────────────────────────────
  const todayStr    = new Date().toISOString().split('T')[0]
  const wasOnTime   = chore.due_date
    ? (todayStr <= chore.due_date ? true : false)
    : null

  // Non-blocking — don't fail the completion if this errors
  void supabase.from('chore_completions').insert({
    household_id:    chore.household_id,
    chore_id:        choreId,
    chore_name:      chore.name,
    category:        chore.category,
    priority:        chore.priority,
    completed_by:    user.id,
    completed_at:    now,
    due_date:        chore.due_date ?? null,
    was_on_time:     wasOnTime,
    points:          chore.points,
    photo_proof_url: photoProofUrl ?? null,
  })

  // Award points (non-blocking — don't fail the completion if this errors)
  if (chore.points > 0) {
    await supabase.from('point_events').insert({
      user_id:      user.id,
      household_id: chore.household_id,
      chore_id:     choreId,
      chore_name:   chore.name,
      points:       chore.points,
    })
  }

  // Update streak + check badge milestones (non-blocking)
  await updateStreakAndCheckBadges(supabase, user.id, chore.household_id).catch(() => undefined)

  revalidatePath('/history')

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Reopen ────────────────────────────────────────────────────────────────────

export async function reopenChore(choreId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: chore } = await supabase
    .from('chores')
    .select('household_id, frequency')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }
  if (chore.frequency !== 'one-time') {
    return { error: 'Only one-time chores can be reopened. Recurring chores reset automatically.' }
  }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: chore.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can reopen chores.' }

  const { error: dbErr } = await supabase
    .from('chores')
    .update({ status: 'incomplete', completed_at: null, completed_by: null, photo_proof_url: null })
    .eq('id', choreId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Upload photo proof ────────────────────────────────────────────────────────

export async function uploadChorePhoto(choreId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const file = formData.get('photo') as File
  if (!file || file.size === 0) return { error: 'No file provided.' }
  if (file.size > 8 * 1024 * 1024) return { error: 'Photo must be under 8 MB.' }

  const ext      = file.name.split('.').pop() ?? 'jpg'
  const filePath = `${choreId}/${user.id}-${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('chore-photos')
    .upload(filePath, file, { upsert: true, contentType: file.type })

  if (uploadErr) return { error: uploadErr.message }

  const { data } = supabase.storage.from('chore-photos').getPublicUrl(filePath)
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  const { error: dbErr } = await supabase
    .from('chores')
    .update({ photo_proof_url: publicUrl })
    .eq('id', choreId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath('/chores')
  return { success: true, photoUrl: publicUrl }
}
