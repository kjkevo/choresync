'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchedulingSuggestion {
  assigneeId:          string
  assigneeName:        string
  bestDayOfWeek:       number   // 0=Sun … 6=Sat
  bestDayLabel:        string   // 'Sunday'
  avgCompletionHour:   number   // 0–23
  completionCount:     number
  onTimeRate:          number   // 0–1
  suggestedDueDate:    string   // ISO YYYY-MM-DD
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function nextOccurrenceOfDay(dayOfWeek: number): string {
  const today = new Date()
  const todayDow = today.getDay()
  let daysAhead = dayOfWeek - todayDow
  if (daysAhead <= 0) daysAhead += 7
  const next = new Date(today)
  next.setDate(today.getDate() + daysAhead)
  return next.toISOString().split('T')[0]
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function getSchedulingSuggestions(
  householdId: string,
  category?: string,
  assigneeId?: string,
): Promise<SchedulingSuggestion[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Verify membership
  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()
  if (!membership) return []

  // Fetch last 90 days of completions
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('chore_completions')
    .select('completed_by, completed_at, was_on_time, category')
    .eq('household_id', householdId)
    .gte('completed_at', since)

  if (category) query = query.eq('category', category)
  if (assigneeId) query = query.eq('completed_by', assigneeId)

  const { data: completions } = await query
  if (!completions || completions.length === 0) return []

  // Group by completed_by
  const grouped: Record<string, typeof completions> = {}
  for (const c of completions) {
    const uid = c.completed_by as string
    if (!grouped[uid]) grouped[uid] = []
    grouped[uid].push(c)
  }

  // Fetch member names
  const userIds = Object.keys(grouped)
  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const nameMap: Record<string, string> = {}
  for (const p of (memberProfiles ?? []) as { id: string; full_name: string | null }[]) {
    nameMap[p.id] = p.full_name ?? 'Unknown'
  }

  // Compute suggestions
  const suggestions: SchedulingSuggestion[] = userIds.map(uid => {
    const rows = grouped[uid]

    // Day-of-week frequency
    const dayCount: number[] = [0, 0, 0, 0, 0, 0, 0]
    let totalHour = 0
    let onTimeCount = 0

    for (const r of rows) {
      const d = new Date(r.completed_at as string)
      dayCount[d.getDay()]++
      totalHour += d.getHours()
      if (r.was_on_time) onTimeCount++
    }

    const bestDayOfWeek = dayCount.indexOf(Math.max(...dayCount))
    const avgCompletionHour = Math.round(totalHour / rows.length)
    const onTimeRate = rows.length > 0 ? onTimeCount / rows.length : 0

    return {
      assigneeId:        uid,
      assigneeName:      nameMap[uid] ?? 'Unknown',
      bestDayOfWeek,
      bestDayLabel:      DAY_LABELS[bestDayOfWeek],
      avgCompletionHour,
      completionCount:   rows.length,
      onTimeRate,
      suggestedDueDate:  nextOccurrenceOfDay(bestDayOfWeek),
    }
  })

  // Sort by completionCount desc
  suggestions.sort((a, b) => b.completionCount - a.completionCount)

  return suggestions
}
