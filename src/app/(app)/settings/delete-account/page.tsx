import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeleteAccountClient from './DeleteAccountClient'

export const metadata: Metadata = { title: 'Delete Account' }
export const dynamic = 'force-dynamic'

export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth gate
  if (!user) redirect('/login?redirectTo=/settings/delete-account')

  return <DeleteAccountClient user={user} />
}
