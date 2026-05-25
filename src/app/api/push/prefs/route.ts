import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface NotifPrefsPayload {
  householdId:     string
  notify_due:      boolean
  notify_overdue:  boolean
  notify_assigned: boolean
  notify_nudge:    boolean
  quiet_start:     string | null   // "HH:MM" UTC or null
  quiet_end:       string | null   // "HH:MM" UTC or null
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const householdId = url.searchParams.get('householdId')
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 })

  const { data } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle()

  return NextResponse.json({ prefs: data ?? null })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as NotifPrefsPayload

  const { error } = await supabase.from('user_notification_prefs').upsert({
    user_id:         user.id,
    household_id:    body.householdId,
    notify_due:      body.notify_due,
    notify_overdue:  body.notify_overdue,
    notify_assigned: body.notify_assigned,
    notify_nudge:    body.notify_nudge,
    quiet_start:     body.quiet_start,
    quiet_end:       body.quiet_end,
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'user_id,household_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
