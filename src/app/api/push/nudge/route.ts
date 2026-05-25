import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToMany, isInQuietHours } from '@/lib/push'
import type { StoredSubscription } from '@/lib/push'

// Rate limit: one nudge per chore per sender per 60 minutes
const NUDGE_COOLDOWN_MINUTES = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { choreId, householdId } = await req.json() as {
    choreId:     string
    householdId: string
  }

  // ── 1. Load chore + assignee ───────────────────────────────────────────────
  const { data: chore } = await supabase
    .from('chores')
    .select('id, name, assigned_to, household_id')
    .eq('id', choreId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!chore) return NextResponse.json({ error: 'Chore not found' }, { status: 404 })
  if (!chore.assigned_to) return NextResponse.json({ error: 'Chore has no assignee' }, { status: 400 })
  if (chore.assigned_to === user.id) return NextResponse.json({ error: 'Cannot nudge yourself' }, { status: 400 })

  const receiverId = chore.assigned_to as string

  // ── 2. Rate-limit check ────────────────────────────────────────────────────
  const cooldownStart = new Date(Date.now() - NUDGE_COOLDOWN_MINUTES * 60_000).toISOString()
  const { data: recentNudge } = await supabase
    .from('nudge_log')
    .select('id')
    .eq('chore_id', choreId)
    .eq('sender_id', user.id)
    .gte('sent_at', cooldownStart)
    .limit(1)
    .maybeSingle()

  if (recentNudge) {
    return NextResponse.json(
      { error: `You already nudged about this chore recently. Try again in ${NUDGE_COOLDOWN_MINUTES} minutes.` },
      { status: 429 }
    )
  }

  // ── 3. Check receiver's notification prefs + quiet hours ──────────────────
  const { data: prefs } = await supabase
    .from('user_notification_prefs')
    .select('notify_nudge, quiet_start, quiet_end')
    .eq('user_id', receiverId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (prefs && prefs.notify_nudge === false) {
    // Receiver has opted out — still log the nudge, just don't push
    return NextResponse.json({ ok: true, skipped: 'receiver_opted_out' })
  }

  if (prefs && isInQuietHours(prefs.quiet_start, prefs.quiet_end)) {
    return NextResponse.json({ ok: true, skipped: 'quiet_hours' })
  }

  // ── 4. Get sender's name ────────────────────────────────────────────────────
  const { data: sender } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const senderName = (sender as { full_name: string | null } | null)?.full_name ?? 'Your roommate'

  // ── 5. Fetch receiver's push subscriptions ─────────────────────────────────
  const { data: subRows } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', receiverId)

  const subs = ((subRows ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>)
    .map(s => ({ id: s.id, endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as StoredSubscription & { id: string }))

  if (subs.length > 0) {
    const expired = await sendPushToMany(subs, {
      title: '👋 Friendly nudge!',
      body:  `${senderName} says: don't forget "${chore.name}"`,
      tag:   `nudge-${choreId}`,
      url:   '/chores',
    })
    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }
  }

  // ── 6. Log the nudge ───────────────────────────────────────────────────────
  await supabase.from('nudge_log').insert({
    chore_id:    choreId,
    sender_id:   user.id,
    receiver_id: receiverId,
  })

  return NextResponse.json({ ok: true })
}
