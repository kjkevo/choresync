import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import HistoryClient from './HistoryClient'
import type {
  UserRow,
  ChoreCompletionRow,
  ChoreCompletionWithMember,
  AnalyticsSummary,
  MemberStat,
  CategoryStat,
  WeeklyTrend,
} from '@/lib/types/database'


export const metadata: Metadata = { title: 'History & Reports' }
export const dynamic = 'force-dynamic'

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(d = new Date()) {
  const day = new Date(d)
  day.setDate(d.getDate() - ((d.getDay() + 6) % 7))  // Mon-start
  day.setHours(0, 0, 0, 0)
  return day
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// ── Analytics aggregator ──────────────────────────────────────────────────────

interface CompletionRaw {
  completed_by: string
  completed_at: string
  was_on_time:  boolean | null
  category:     string
  points:       number
}

function aggregate(
  rows:    CompletionRaw[],
  since:   Date,
  members: { id: string; name: string | null; avatarUrl: string | null; color: string }[],
): AnalyticsSummary {
  const inPeriod = rows.filter(r => new Date(r.completed_at) >= since)

  let onTime = 0, late = 0, noDueDate = 0, totalPoints = 0
  const byMemberMap = new Map<string, { completions: number; onTime: number; late: number; points: number }>()
  const byCategoryMap = new Map<string, number>()

  for (const r of inPeriod) {
    if (r.was_on_time === true) onTime++
    else if (r.was_on_time === false) late++
    else noDueDate++
    totalPoints += r.points

    const m = byMemberMap.get(r.completed_by) ?? { completions: 0, onTime: 0, late: 0, points: 0 }
    m.completions++
    if (r.was_on_time === true)  m.onTime++
    if (r.was_on_time === false) m.late++
    m.points += r.points
    byMemberMap.set(r.completed_by, m)

    byCategoryMap.set(r.category, (byCategoryMap.get(r.category) ?? 0) + 1)
  }

  const byMember: MemberStat[] = members
    .map(mem => {
      const s = byMemberMap.get(mem.id) ?? { completions: 0, onTime: 0, late: 0, points: 0 }
      return { userId: mem.id, name: mem.name, avatarUrl: mem.avatarUrl, color: mem.color, ...s }
    })
    .sort((a, b) => b.completions - a.completions)

  const byCategory: CategoryStat[] = [...byCategoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  return { total: inPeriod.length, onTime, late, noDueDate, totalPoints, byMember, byCategory, weeklyTrend: [] }
}

function buildTrend(rows: CompletionRaw[], weeksBack = 8): WeeklyTrend[] {
  const now   = new Date()
  const trend: WeeklyTrend[] = []
  for (let i = weeksBack - 1; i >= 0; i--) {
    const ws = startOfWeek(new Date(now))
    ws.setDate(ws.getDate() - i * 7)
    const we = new Date(ws)
    we.setDate(ws.getDate() + 7)
    const count = rows.filter(r => {
      const d = new Date(r.completed_at)
      return d >= ws && d < we
    }).length
    trend.push({
      weekLabel: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekStart: ws.toISOString().split('T')[0],
      count,
    })
  }
  return trend
}

// Compute a simple { total, onTime, late } snapshot for a period slice
function periodSnapshot(rows: CompletionRaw[], from: Date, to: Date): { total: number; onTime: number; late: number } {
  const slice = rows.filter(r => {
    const d = new Date(r.completed_at)
    return d >= from && d < to
  })
  let onTime = 0, late = 0
  for (const r of slice) {
    if (r.was_on_time === true)  onTime++
    if (r.was_on_time === false) late++
  }
  return { total: slice.length, onTime, late }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Profile + membership ───────────────────────────────────────────────
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, role').eq('user_id', user.id).maybeSingle(),
  ])
  if (!membership) redirect('/onboarding')
  const { household_id: householdId } = membership

  // ── 2. Members ────────────────────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('household_members').select('user_id, color_theme').eq('household_id', householdId)

  const memberRowsTyped = (memberRows ?? []) as { user_id: string; color_theme: string }[]
  const colorMap      = Object.fromEntries(memberRowsTyped.map(m => [m.user_id, m.color_theme]))
  const memberUserIds = memberRowsTyped.map(m => m.user_id)

  const { data: memberProfilesRaw } = await supabase
    .from('users').select('id, full_name, avatar_url, email').in('id', memberUserIds)
  const memberProfiles = (memberProfilesRaw ?? []) as UserRow[]
  const profileMap: Record<string, UserRow> = Object.fromEntries(memberProfiles.map(p => [p.id, p]))

  const members = memberUserIds.map(uid => ({
    id:        uid,
    name:      profileMap[uid]?.full_name ?? null,
    avatarUrl: profileMap[uid]?.avatar_url ?? null,
    color:     colorMap[uid] ?? '#6366f1',
  }))

  // ── 3. Last 180 days of completions (extended for prev-month comparison) ──
  const since180 = new Date()
  since180.setDate(since180.getDate() - 180)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const todayStr   = today.toISOString().split('T')[0]
  const in7DaysStr = in7Days.toISOString().split('T')[0]

  // Run completions + upcoming chores + household name in parallel
  const [
    { data: raw },
    { data: upcomingRaw },
    { data: household },
  ] = await Promise.all([
    supabase
      .from('chore_completions')
      .select('*')
      .eq('household_id', householdId)
      .gte('completed_at', since180.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1000),
    supabase
      .from('chores')
      .select('id, name, category, due_date, assigned_to, priority, points')
      .eq('household_id', householdId)
      .eq('status', 'incomplete')
      .not('due_date', 'is', null)
      .gte('due_date', todayStr)
      .lte('due_date', in7DaysStr)
      .order('due_date', { ascending: true })
      .limit(20),
    supabase
      .from('households').select('name').eq('id', householdId).maybeSingle(),
  ])

  const completions = (raw ?? []) as ChoreCompletionRow[]

  // Enrich log entries with member info
  const logEntries: ChoreCompletionWithMember[] = completions.map(c => ({
    ...c,
    member: members.find(m => m.id === c.completed_by) ?? null,
  }))

  // ── 4. Analytics ──────────────────────────────────────────────────────────
  const weekSummary  = aggregate(completions, startOfWeek(),  members)
  const monthSummary = aggregate(completions, startOfMonth(), members)

  // Attach weekly trend (uses all 180 days for context)
  weekSummary.weeklyTrend  = buildTrend(completions, 8)
  monthSummary.weeklyTrend = buildTrend(completions, 8)

  // ── 5. Previous-period snapshots ──────────────────────────────────────────
  const thisWeekStart  = startOfWeek()
  const prevWeekStart  = new Date(thisWeekStart)
  prevWeekStart.setDate(thisWeekStart.getDate() - 7)

  const thisMonthStart = startOfMonth()
  const prevMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1)

  const prevWeekSnap  = periodSnapshot(completions, prevWeekStart, thisWeekStart)
  const prevMonthSnap = periodSnapshot(completions, prevMonthStart, thisMonthStart)

  // ── 6. Enrich upcoming chores ─────────────────────────────────────────────
  type UpcomingRaw = { id: string; name: string; category: string; due_date: string | null; assigned_to: string | null; priority: string; points: number }
  const upcomingChores = (upcomingRaw ?? []).map((c: UpcomingRaw) => {
    const profile = c.assigned_to ? profileMap[c.assigned_to] : null
    const color   = c.assigned_to ? (colorMap[c.assigned_to] ?? '#6366f1') : '#94a3b8'
    return {
      id:            c.id,
      name:          c.name,
      category:      c.category,
      dueDate:       c.due_date ?? '',
      assigneeName:  profile?.full_name ?? null,
      assigneeColor: color,
      priority:      c.priority ?? 'medium',
      points:        c.points ?? 0,
    }
  })

  // suppress unused warning — profile is used via household_id path
  void profile

  return (
    <HistoryClient
      householdName={household?.name ?? 'Your Household'}
      householdId={householdId}
      currentUserId={user.id}
      members={members}
      logEntries={logEntries}
      weekSummary={weekSummary}
      monthSummary={monthSummary}
      prevWeekSnap={prevWeekSnap}
      prevMonthSnap={prevMonthSnap}
      upcomingChores={upcomingChores}
    />
  )
}
