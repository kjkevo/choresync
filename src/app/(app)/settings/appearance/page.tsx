import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppearanceClient from './AppearanceClient'

export const metadata: Metadata = { title: 'Appearance' }
export const dynamic = 'force-dynamic'

export default async function AppearancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth gate
  if (!user) redirect('/login?redirectTo=/settings/appearance')

  return <AppearanceClient user={user} />
}
