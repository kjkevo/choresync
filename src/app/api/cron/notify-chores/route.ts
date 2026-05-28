/**
 * Vercel Cron Job — runs every hour to send due/overdue push notifications.
 * Secured with CRON_SECRET header.
 */
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendPushToMany, isInQuietHours } from '@/lib/push'
import type { StoredSubscription } from '@/lib/push'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Use service role to bypass RLS for cron reads
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  // Vercel cron jobs send the secret as: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const secret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  const db = getAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // ── 1. Find due chores (due today, incomplete, assigned) ──────────────────
  const { data: dueChores } = await db
    .from('chores')
    .select('id, name, assigned_to, household_id, due_date')
    .eq('status', 'incomplete')
    .eq('due_date', today)
    .not('assigned_to', 'is', null)

  // ── 2. Find overdue chores (due before today, incomplete, assigned) ────────
  const { data: overdueChores } = await db
    .from('chores')
    .select('id, name, assigned_to, household_id, due_date')
    .eq('status', 'incomplete')
    .lt('due_date', today)
    .not('assigned_to', 'is', null)

  // Collect unique user IDs
  const allChores = [...(dueChores ?? []), ...(overdueChores ?? [])] as Array<{
    id: string; name: string; assigned_to: string; household_id: string; due_date: string
  }>

  if (allChores.length === 0) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(allChores.map(c => c.assigned_to))]

  // ── 3. Load prefs + subscriptions for all relevant users ──────────────────
  const [{ data: prefsRows }, { data: subRows }] = await Promise.all([
    db.from('user_notification_prefs')
      .select('user_id, household_id, notify_due, notify_overdue, quiet_start, quiet_end')
      .in('user_id', userIds),
    db.from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds),
  ])

  type PrefRow = { user_id: string; household_id: string; notify_due: boolean; notify_overdue: boolean; quiet_start: string | null; quiet_end: string | null }
  type SubRow  = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

  const prefsMap = new Map<string, PrefRow>()
  for (const p of (prefsRows ?? []) as PrefRow[]) {
    prefsMap.set(`${p.user_id}:${p.household_id}`, p)
  }

  const subsMap = new Map<string, Array<SubRow & { id: string }>>()
  for (const s of (subRows ?? []) as SubRow[]) {
    if (!subsMap.has(s.user_id)) subsMap.set(s.user_id, [])
    subsMap.get(s.user_id)!.push(s)
  }

  let sent = 0
  const expiredSubIds: string[] = []

  async function notify(chore: typeof allChores[number], type: 'due' | 'overdue') {
    const userId = chore.assigned_to
    const prefs  = prefsMap.get(`${userId}:${chore.household_id}`)

    // Check opt-in (default: true if no prefs row)
    if (prefs) {
      const opted = type === 'due' ? prefs.notify_due : prefs.notify_overdue
      if (!opted) return
      if (isInQuietHours(prefs.quiet_start, prefs.quiet_end)) return
    }

    const subs = (subsMap.get(userId) ?? []).map(s => ({
      id:       s.id,
      endpoint: s.endpoint,
      keys:     { p256dh: s.p256dh, auth: s.auth },
    })) as Array<StoredSubscription & { id: string }>

    if (subs.length === 0) return

    const payload = type === 'due'
      ? { title: '📋 Chore due today', body: `"${chore.name}" is due today!`, tag: `due-${chore.id}`, url: '/chores' }
      : { title: '⚠️ Overdue chore', body: `"${chore.name}" is overdue — take care of it!`, tag: `overdue-${chore.id}`, url: '/chores' }

    const expired = await sendPushToMany(subs, payload)
    expiredSubIds.push(...expired)
    sent++
  }

  await Promise.all([
    ...(dueChores ?? []).map(c => notify(c as typeof allChores[number], 'due')),
    ...(overdueChores ?? []).map(c => notify(c as typeof allChores[number], 'overdue')),
  ])

  // Clean up dead subscriptions
  if (expiredSubIds.length > 0) {
    await db.from('push_subscriptions').delete().in('id', expiredSubIds)
  }

  return NextResponse.json({ sent, expiredCleaned: expiredSubIds.length })
}
