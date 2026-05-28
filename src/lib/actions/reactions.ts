'use server'

import { createClient } from '@/lib/supabase/server'

const ALLOWED_EMOJIS = ['👍', '❤️', '🔥', '🎉', '💪', '😂'] as const

export async function addCompletionReaction(
  completionId: string,
  emoji: string,
  householdId: string,
): Promise<{ error?: string }> {
  if (!ALLOWED_EMOJIS.includes(emoji as (typeof ALLOWED_EMOJIS)[number])) {
    return { error: 'Invalid emoji' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify household membership
  const { data: membership } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!membership) return { error: 'Not a household member' }

  const { error } = await supabase
    .from('chore_completion_reactions')
    .insert({ completion_id: completionId, user_id: user.id, household_id: householdId, emoji })

  // Ignore unique-constraint violations (already reacted) — Postgres code 23505
  if (error && (error as { code?: string }).code !== '23505') {
    return { error: error.message }
  }
  return {}
}

export async function removeCompletionReaction(
  completionId: string,
  emoji: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('chore_completion_reactions')
    .delete()
    .eq('completion_id', completionId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)

  if (error) return { error: error.message }
  return {}
}

export async function getLatestCompletionForChore(choreId: string): Promise<{
  completionId: string | null
  reactions: { emoji: string; userId: string }[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completionId: null, reactions: [] }

  // Get latest completion for this chore
  const { data: completion } = await supabase
    .from('chore_completions')
    .select('id')
    .eq('chore_id', choreId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!completion) return { completionId: null, reactions: [] }

  // Get reactions for that completion
  const { data: reactionsRaw } = await supabase
    .from('chore_completion_reactions')
    .select('emoji, user_id')
    .eq('completion_id', completion.id)

  const reactions = ((reactionsRaw ?? []) as { emoji: string; user_id: string }[]).map(r => ({
    emoji: r.emoji,
    userId: r.user_id,
  }))

  return { completionId: completion.id, reactions }
}
