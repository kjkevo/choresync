'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthedUserAndMembership(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, user: null, membership: null }

  const { data: membership } = await supabase
    .from('household_members')
    .select('id, user_id')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!membership) return { error: 'Not a member of this household' as const, user: null, membership: null }

  return { error: null, user, membership }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addSupplyItem(formData: FormData) {
  const supabase = await createClient()

  const householdId = formData.get('householdId') as string
  const name        = (formData.get('name') as string | null)?.trim()
  const quantity    = (formData.get('quantity') as string | null)?.trim() || '1'
  const unit        = (formData.get('unit') as string | null)?.trim() || ''
  const category    = (formData.get('category') as string | null)?.trim() || 'general'
  const choreId     = (formData.get('choreId') as string | null) || null
  const choreName   = (formData.get('choreName') as string | null) || null

  if (!householdId || !name) return { error: 'Name and householdId are required.' }

  const { error: authError, user } = await getAuthedUserAndMembership(supabase, householdId)
  if (authError) return { error: authError }

  const { error } = await supabase.from('supply_items').insert({
    household_id: householdId,
    name,
    quantity,
    unit,
    category,
    added_by:   user!.id,
    chore_id:   choreId,
    chore_name: choreName,
    is_checked: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/supplies')
  return { error: null }
}

export async function toggleSupplyItem(itemId: string, isChecked: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Fetch item to verify household membership
  const { data: item } = await supabase
    .from('supply_items')
    .select('household_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return { error: 'Item not found' }

  const { error: authError } = await getAuthedUserAndMembership(supabase, item.household_id)
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('supply_items')
    .update({
      is_checked: isChecked,
      checked_by: isChecked ? user.id : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath('/supplies')
  return { error: null }
}

export async function deleteSupplyItem(itemId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Fetch item to verify household membership
  const { data: item } = await supabase
    .from('supply_items')
    .select('household_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return { error: 'Item not found' }

  const { error: authError } = await getAuthedUserAndMembership(supabase, item.household_id)
  if (authError) return { error: authError }

  const { error } = await supabase.from('supply_items').delete().eq('id', itemId)
  if (error) return { error: error.message }

  revalidatePath('/supplies')
  return { error: null }
}

export async function clearCheckedItems(householdId: string) {
  const supabase = await createClient()

  const { error: authError } = await getAuthedUserAndMembership(supabase, householdId)
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('supply_items')
    .delete()
    .eq('household_id', householdId)
    .eq('is_checked', true)

  if (error) return { error: error.message }

  revalidatePath('/supplies')
  return { error: null }
}
