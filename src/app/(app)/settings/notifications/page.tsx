import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient from './NotificationsClient'

export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth gate
  if (!user) redirect('/login?redirectTo=/settings/notifications')

  // Fetch user's notification preferences
  const { data: preferencesRaw } = await supabase
    .from('users')
    .select('notification_chore_reminders, notification_new_messages, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
    .eq('id', user.id)
    .single()

  const preferences = (preferencesRaw as any) ?? {
    notification_chore_reminders: true,
    notification_new_messages: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '21:00',
    quiet_hours_end: '08:00',
  }

  return (
    <NotificationsClient
      user={user}
      preferences={preferences}
    />
  )
}
