import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import QuickClient from './QuickClient'
import type { ChoreRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Today' }
export const dynamic = 'force-dynamic'

export default async function QuickPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) redirect('/login') // TODO: re-enable
  if (!user) redirect('/onboarding')
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { household_id: householdId } = membership

  const today = new Date().toISOString().split('T')[0]

  // Fetch chores assigned to current user that are overdue or due today, not completed
  const { data: choreRowsRaw } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .eq('assigned_to', user.id)
    .eq('status', 'incomplete')
    .lte('due_date', today)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })

  const chores = (choreRowsRaw ?? []) as ChoreRow[]

  return <QuickClient chores={chores} userId={user.id} householdId={householdId} />
}
