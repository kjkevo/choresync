import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ChoresClient from './ChoresClient'
import type { ChoreWithAssignee, UserRow, SwapRequestWithDetails, HouseholdSettings } from '@/lib/types/database'

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
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id, color_theme')
    .eq('household_id', householdId)

  const memberUserIds = (memberRows ?? []).map(m => m.user_id)
  const colorMap = Object.fromEntries((memberRows ?? []).map(m => [m.user_id, m.color_theme]))

  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .in('id', memberUserIds)

  const profileMap = Object.fromEntries((memberProfiles ?? []).map(p => [p.id, p]))

  const members: (UserRow & { color_theme: string })[] = (memberProfiles ?? []).map(p => ({
    ...p,
    color_theme: colorMap[p.id] ?? '#6366f1',
  }))

  // ── 3. All chores ─────────────────────────────────────────────────────────
  const { data: choreRows } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .order('due_date',   { ascending: true,  nullsFirst: false })
    .order('priority',   { ascending: false })
    .order('created_at', { ascending: false })

  const chores: ChoreWithAssignee[] = (choreRows ?? []).map(c => ({
    ...c,
    rotation_members: Array.isArray(c.rotation_members) ? c.rotation_members as string[] : [],
    assignee: c.assigned_to ? (profileMap[c.assigned_to] ?? null) : null,
  }))

  // ── 4. Household settings (for custom categories + point defaults) ───────
  const { data: hhRow } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .maybeSingle()

  const hhSettings = (hhRow?.settings ?? {}) as HouseholdSettings

  // ── 5. Pending swap requests where current user is the requestee ──────────
  const { data: rawSwaps } = await supabase
    .from('swap_requests')
    .select('*')
    .eq('requestee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Enrich swaps with chore name + requester profile
  const swapChoreIds    = (rawSwaps ?? []).map(s => s.chore_id)
  const swapRequesterIds = (rawSwaps ?? []).map(s => s.requester_id)

  const [{ data: swapChores }, { data: swapRequesters }] = await Promise.all([
    swapChoreIds.length > 0
      ? supabase.from('chores').select('id, name').in('id', swapChoreIds)
      : Promise.resolve({ data: [] }),
    swapRequesterIds.length > 0
      ? supabase.from('users').select('id, full_name, avatar_url, email').in('id', swapRequesterIds)
      : Promise.resolve({ data: [] }),
  ])

  const swapChoreMap     = Object.fromEntries((swapChores     ?? []).map(c => [c.id, c]))
  const swapRequesterMap = Object.fromEntries((swapRequesters ?? []).map(u => [u.id, u]))

  const pendingSwaps: SwapRequestWithDetails[] = (rawSwaps ?? []).map(s => ({
    ...s,
    chore:     swapChoreMap[s.chore_id]     ?? null,
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
    />
  )
}
