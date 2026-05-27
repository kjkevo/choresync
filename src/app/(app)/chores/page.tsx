import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ChoresClient from './ChoresClient'
import type { ChoreRow, ChoreWithAssignee, UserRow, SwapRequestRow, SwapRequestWithDetails, HouseholdSettings } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Chores' }
export const dynamic = 'force-dynamic'

export default async function ChoresPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 1. Caller's household membership ─────────────────────────────────────
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, color_theme')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { household_id: householdId, role } = membership
  const isAdmin = role === 'admin'

  // ── 2. All members ────────────────────────────────────────────────────────
  const { data: memberRowsRaw } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberRows = (memberRowsRaw ?? []) as { user_id: string; color_theme: string }[]
  const memberUserIds = memberRows.map(m => m.user_id)
  const colorMap = Object.fromEntries(memberRows.map(m => [m.user_id, m.color_theme]))

  const { data: memberProfilesRaw } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const memberProfiles = (memberProfilesRaw ?? []) as UserRow[]
  const profileMap: Record<string, UserRow> = Object.fromEntries(memberProfiles.map(p => [p.id, p]))

  const members: (UserRow & { color_theme: string })[] = memberProfiles.map(p => ({
    ...p,
    color_theme: colorMap[p.id] ?? '#6366f1',
  }))

  // ── 3. All chores ─────────────────────────────────────────────────────────
  const { data: choreRowsRaw } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .order('due_date',   { ascending: true,  nullsFirst: false })
    .order('priority',   { ascending: false })
    .order('created_at', { ascending: false })

  const choreRows = (choreRowsRaw ?? []) as ChoreRow[]
  const chores: ChoreWithAssignee[] = choreRows.map(c => ({
    ...c,
    rotation_members: Array.isArray(c.rotation_members) ? c.rotation_members as unknown as string[] : [],
    assignee: c.assigned_to ? (profileMap[c.assigned_to] ?? null) : null,
  }))

  // ── 3b. Comment counts ────────────────────────────────────────────────────
  const choreIds = choreRows.map(c => c.id)
  const { data: commentCountsRaw } = choreIds.length > 0
    ? await supabase.from('chore_comments').select('chore_id').in('chore_id', choreIds)
    : { data: [] }
  const commentCounts: Record<string, number> = {}
  for (const row of (commentCountsRaw ?? []) as { chore_id: string }[]) {
    commentCounts[row.chore_id] = (commentCounts[row.chore_id] ?? 0) + 1
  }

  // ── 4. Household settings (for custom categories + point defaults) ───────
  const { data: hhRowRaw } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const hhRow = hhRowRaw as { settings: unknown } | null
  const hhSettings = (hhRow?.settings ?? {}) as HouseholdSettings

  // ── 5. Pending swap requests where current user is the requestee ──────────
  const { data: rawSwapsRaw } = await supabase
    .from('swap_requests')
    .select('*')
    .eq('requestee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const rawSwaps = (rawSwapsRaw ?? []) as SwapRequestRow[]
  const swapChoreIds     = rawSwaps.map(s => s.chore_id)
  const swapRequesterIds = rawSwaps.map(s => s.requester_id)

  const [{ data: swapChoresRaw }, { data: swapRequestersRaw }] = await Promise.all([
    swapChoreIds.length > 0
      ? supabase.from('chores').select('id, name').in('id', swapChoreIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    swapRequesterIds.length > 0
      ? supabase.from('users').select('id, full_name, avatar_url, email').in('id', swapRequesterIds)
      : Promise.resolve({ data: [] as UserRow[] }),
  ])

  const swapChoreMap     = Object.fromEntries(((swapChoresRaw ?? []) as { id: string; name: string }[]).map(c => [c.id, c]))
  const swapRequesterMap = Object.fromEntries(((swapRequestersRaw ?? []) as UserRow[]).map(u => [u.id, u]))

  const pendingSwaps: SwapRequestWithDetails[] = rawSwaps.map(s => ({
    ...s,
    chore:     swapChoreMap[s.chore_id]        ?? null,
    requester: swapRequesterMap[s.requester_id] ?? null,
  }))

  return (
    <ChoresClient
      initialChores={chores}
      members={members}
      householdId={householdId}
      currentUserId={user.id}
      isAdmin={isAdmin}
      colorMap={colorMap}
      pendingSwaps={pendingSwaps}
      pointDefaults={hhSettings.pointValues}
      customCategories={hhSettings.customCategories ?? []}
      commentCounts={commentCounts}
    />
  )
}
