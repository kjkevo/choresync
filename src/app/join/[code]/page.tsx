import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import JoinClient from './JoinClient'

export const metadata: Metadata = { title: 'Join Household | ChoreSync' }
export const dynamic = 'force-dynamic'

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const upperCode = code.toUpperCase()

  const supabase = await createClient()

  // Look up the household by invite code
  const { data: household } = await supabase
    .from('households')
    .select('id, name')
    .eq('invite_code', upperCode)
    .maybeSingle()

  let memberCount = 0
  if (household?.id) {
    const { count } = await supabase
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.id)
    memberCount = count ?? 0
  }

  return (
    <JoinClient
      code={upperCode}
      householdName={household?.name ?? null}
      memberCount={memberCount}
    />
  )
}
