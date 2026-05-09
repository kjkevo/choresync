'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MessageEmoji } from '@/lib/types/database'

const VALID_EMOJIS: MessageEmoji[] = ['👍', '❤️', '😂', '😮', '🎉', '🔥']

// ── Send ──────────────────────────────────────────────────────────────────────

export async function sendMessage(householdId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) return { error: 'Message must be 1–2000 characters.' }

  const { data: member } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { error: 'Not a member of this household.' }

  const { data, error } = await supabase
    .from('messages')
    .insert({ household_id: householdId, user_id: user.id, content: trimmed })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, message: data }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteMessage(messageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: msg } = await supabase
    .from('messages')
    .select('user_id, household_id')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg) return { error: 'Message not found.' }

  // Author can always delete; admins can also delete
  const isAuthor = msg.user_id === user.id
  if (!isAuthor) {
    const { data: isAdmin } = await supabase.rpc('is_household_admin', {
      p_household_id: msg.household_id,
    })
    if (!isAdmin) return { error: 'Only the author or an admin can delete this message.' }
  }

  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  if (error) return { error: error.message }
  return { success: true }
}

// ── Toggle reaction ───────────────────────────────────────────────────────────

export async function toggleReaction(messageId: string, emoji: MessageEmoji) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  if (!VALID_EMOJIS.includes(emoji)) return { error: 'Invalid emoji.' }

  // Check if reaction already exists (upsert / delete toggle)
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { success: true, action: 'removed' as const }
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
    if (error) return { error: error.message }
    return { success: true, action: 'added' as const }
  }
}
