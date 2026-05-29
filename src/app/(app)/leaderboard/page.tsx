import { createClient } from '@/lib/supabase/server'
import LeaderboardClient from './LeaderboardClient'

export const metadata = { title: 'Leaderboard' }
export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get first household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, color_theme')
    .eq('user_id', user?.id ?? '')
    .limit(1)
    .maybeSingle()

  const householdId = membership?.household_id ?? ''

  // Aggregate points per user from chore_completions
  const { data: rawPoints } = await supabase
    .from('chore_completions')
    .select('completed_by, points')
    .eq('household_id', householdId)

  // Sum points per user
  const pointsMap: Record<string, { points: number; completions: number }> = {}
  for (const row of (rawPoints ?? []) as { completed_by: string; points: number }[]) {
    if (!pointsMap[row.completed_by]) pointsMap[row.completed_by] = { points: 0, completions: 0 }
    pointsMap[row.completed_by].points += row.points ?? 0
    pointsMap[row.completed_by].completions += 1
  }

  // Fetch member profiles
  const userIds = Object.keys(pointsMap)
  const { data: profiles } = userIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url').in('id', userIds)
    : { data: [] }

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const colorMap: Record<string, string> = Object.fromEntries(
    ((memberRows ?? []) as { user_id: string; color_theme: string }[]).map(m => [m.user_id, m.color_theme])
  )

  const leaderboard = Object.entries(pointsMap).map(([uid, stats]) => {
    const p = ((profiles ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).find(x => x.id === uid)
    return {
      userId:      uid,
      name:        p?.full_name ?? 'Unknown',
      avatarUrl:   p?.avatar_url ?? null,
      color:       colorMap[uid] ?? '#6366f1',
      points:      stats.points,
      completions: stats.completions,
    }
  }).sort((a, b) => b.points - a.points)

  return <LeaderboardClient leaderboard={leaderboard} currentUserId={user?.id ?? ''} />
}
