'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Create ────────────────────────────────────────────────────────────────────

export async function createAnnouncement(householdId: string, content: string, pinned = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', { p_household_id: householdId })
  if (!isAdmin) return { error: 'Only admins can create announcements.' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 1000) return { error: 'Announcement must be 1–1000 characters.' }

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      household_id: householdId,
      created_by:   user.id,
      content:      trimmed,
      is_pinned:    pinned,
      pinned_at:    pinned ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/social')
  revalidatePath('/dashboard')
  return { success: true, announcement: data }
}

// ── Toggle pin ────────────────────────────────────────────────────────────────

export async function toggleAnnouncementPin(announcementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: announcement } = await supabase
    .from('announcements')
    .select('household_id, is_pinned')
    .eq('id', announcementId)
    .maybeSingle()

  if (!announcement) return { error: 'Announcement not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: announcement.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can pin announcements.' }

  const nowPinned = !announcement.is_pinned
  const { error } = await supabase
    .from('announcements')
    .update({
      is_pinned:  nowPinned,
      pinned_at:  nowPinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', announcementId)

  if (error) return { error: error.message }

  revalidatePath('/social')
  revalidatePath('/dashboard')
  return { success: true, is_pinned: nowPinned }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: announcement } = await supabase
    .from('announcements')
    .select('household_id')
    .eq('id', announcementId)
    .maybeSingle()

  if (!announcement) return { error: 'Announcement not found.' }

  const { data: isAdmin } = await supabase.rpc('is_household_admin', {
    p_household_id: announcement.household_id,
  })
  if (!isAdmin) return { error: 'Only admins can delete announcements.' }

  const { error } = await supabase.from('announcements').delete().eq('id', announcementId)
  if (error) return { error: error.message }

  revalidatePath('/social')
  revalidatePath('/dashboard')
  return { success: true }
}
