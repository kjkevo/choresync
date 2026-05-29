import { createClient } from '@/lib/supabase/server'
import CustomClient from './CustomClient'
import type { UserRow } from '@/lib/types/database'

export const metadata = { title: 'Custom Chores' }

export default async function CustomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user?.id ?? '')
    .limit(1)
    .maybeSingle()

  const householdId = membership?.household_id ?? ''

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)

  const userIds = ((memberRows ?? []) as { user_id: string }[]).map(m => m.user_id)

  const { data: profilesRaw } = userIds.length
    ? await supabase.from('users').select('id, full_name, avatar_url, email').in('id', userIds)
    : { data: [] }

  const members = (profilesRaw ?? []) as UserRow[]

  return <CustomClient householdId={householdId} members={members} currentUserId={user?.id ?? ''} />
}
