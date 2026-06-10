import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChangePasswordClient from './ChangePasswordClient'

export const metadata: Metadata = { title: 'Change Password' }
export const dynamic = 'force-dynamic'

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth gate — only logged-in users can change password
  if (!user) redirect('/login?redirectTo=/settings/change-password')

  return <ChangePasswordClient user={user} />
}
