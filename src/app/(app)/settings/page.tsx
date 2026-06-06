import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import type { HouseholdSettings, UserRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Profile + membership ──────────────────────────────────────────────────
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('users').select('id, full_name, avatar_url, email').eq('id', user.id).maybeSingle(),
    supabase.from('household_members').select('household_id, role').eq('user_id', user.id).maybeSingle(),
  ])

  if (!membership) redirect('/onboarding')
  const { household_id: householdId, role } = membership

  // ── Household ─────────────────────────────────────────────────────────────
  const { data: household } = await supabase
    .from('households')
    .select('id, name, settings')
    .eq('id', householdId)
    .maybeSingle()

  const settings = (household?.settings ?? {}) as HouseholdSettings

  return (
    <SettingsClient
      householdId={householdId}
      householdName={household?.name ?? 'My Household'}
      householdSettings={settings}
      currentUserId={user.id}
      currentUserRole={role as 'admin' | 'member'}
      profile={profile as UserRow | null}
    />
  )
}
