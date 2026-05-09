'use server'

import { createClient } from '@/lib/supabase/server'
import type { ChoreCommentWithAuthor, UserRow } from '@/lib/types/database'

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getChoreComments(choreId: string): Promise<{
  data?: ChoreCommentWithAuthor[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: comments, error } = await supabase
    .from('chore_comments')
    .select('*')
    .eq('chore_id', choreId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  // Fetch authors
  const authorIds = [...new Set((comments ?? []).map(c => c.user_id))]
  const { data: profiles } = authorIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url, email').in('id', authorIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p as UserRow]))

  const enriched: ChoreCommentWithAuthor[] = (comments ?? []).map(c => ({
    ...c,
    author: profileMap[c.user_id] ?? null,
  }))

  return { data: enriched }
}

// ── Add ───────────────────────────────────────────────────────────────────────

export async function addChoreComment(choreId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 1000) return { error: 'Comment must be 1–1000 characters.' }

  // Verify membership via the chore's household
  const { data: chore } = await supabase
    .from('chores')
    .select('household_id')
    .eq('id', choreId)
    .maybeSingle()

  if (!chore) return { error: 'Chore not found.' }

  const { data: member } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', chore.household_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { error: 'Not a member of this household.' }

  const { data, error } = await supabase
    .from('chore_comments')
    .insert({
      chore_id:     choreId,
      household_id: chore.household_id,
      user_id:      user.id,
      content:      trimmed,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, comment: data }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteChoreComment(commentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: comment } = await supabase
    .from('chore_comments')
    .select('user_id, household_id')
    .eq('id', commentId)
    .maybeSingle()

  if (!comment) return { error: 'Comment not found.' }

  const isAuthor = comment.user_id === user.id
  if (!isAuthor) {
    const { data: isAdmin } = await supabase.rpc('is_household_admin', {
      p_household_id: comment.household_id,
    })
    if (!isAdmin) return { error: 'Only the author or an admin can delete this comment.' }
  }

  const { error } = await supabase.from('chore_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }
  return { success: true }
}
