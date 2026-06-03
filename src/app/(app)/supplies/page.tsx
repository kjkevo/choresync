import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SuppliesClient from './SuppliesClient'
import type { SupplyItemRow, UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Supply List' }
export const dynamic = 'force-dynamic'

export interface EnrichedSupplyItem extends SupplyItemRow {
  addedByName: string | null
}

export default async function SuppliesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/onboarding')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { household_id: householdId, role } = membership

  // Fetch supply items ordered by created_at desc
  const { data: itemsRaw } = await supabase
    .from('supply_items')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  const items = (itemsRaw ?? []) as SupplyItemRow[]

  // Enrich with added_by name
  const addedByIds = [...new Set(items.map(i => i.added_by).filter(Boolean))] as string[]
  const { data: profilesRaw } = addedByIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', addedByIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of (profilesRaw ?? []) as Pick<UserRow, 'id' | 'full_name'>[]) {
    if (p.full_name) profileMap[p.id] = p.full_name
  }

  const enriched: EnrichedSupplyItem[] = items.map(item => ({
    ...item,
    addedByName: item.added_by ? (profileMap[item.added_by] ?? null) : null,
  }))

  return (
    <SuppliesClient
      items={enriched}
      householdId={householdId}
      currentUserId={user.id}
      currentUserRole={role as 'admin' | 'member' | 'kids'}
    />
  )
}
