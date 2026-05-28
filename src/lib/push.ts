/**
 * Server-side Web Push helper.
 * Sends a push notification to one or more subscriptions.
 */
import webpush from 'web-push'

export interface PushPayload {
  title: string
  body:  string
  icon?: string
  tag?:  string
  url?:  string
}

export interface StoredSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth:   string
  }
}

let _initialised = false
function init() {
  if (_initialised) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  _initialised = true
}

/**
 * Send a push notification to a single stored subscription.
 * Returns true on success, false on permanent failure (subscription gone).
 */
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload,
): Promise<boolean> {
  init()
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload))
    return true
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return false // subscription expired
    console.error('[push] sendNotification error', err)
    return true // keep sub, may be transient
  }
}

/**
 * Send to many subscriptions; returns ids of subscriptions that should be deleted.
 */
export async function sendPushToMany(
  subs: Array<StoredSubscription & { id: string }>,
  payload: PushPayload,
): Promise<string[]> {
  const expired: string[] = []
  await Promise.all(
    subs.map(async s => {
      const ok = await sendPush(s, payload)
      if (!ok) expired.push(s.id)
    })
  )
  return expired
}

/**
 * Notify a user that a chore was assigned to them.
 * Uses the service-role client to bypass RLS for reading prefs/subs.
 * Fire-and-forget safe — errors are logged but not thrown.
 */
export async function notifyAssigned(opts: {
  assigneeId:   string
  householdId:  string
  choreName:    string
  assignerName: string
}): Promise<void> {
  // Guard: skip silently if VAPID credentials are not configured
  if (!process.env.VAPID_EMAIL || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return
  }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Check prefs
    const { data: prefs } = await db
      .from('user_notification_prefs')
      .select('notify_assigned, quiet_start, quiet_end')
      .eq('user_id', opts.assigneeId)
      .eq('household_id', opts.householdId)
      .maybeSingle()

    if (prefs && !prefs.notify_assigned) return
    if (prefs && isInQuietHours(prefs.quiet_start, prefs.quiet_end)) return

    const { data: subRows } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', opts.assigneeId)

    const subs = ((subRows ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>)
      .map(s => ({ id: s.id, endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }))

    if (subs.length === 0) return

    const expired = await sendPushToMany(subs, {
      title: '📋 New chore assigned',
      body:  `${opts.assignerName} assigned you "${opts.choreName}"`,
      tag:   `assigned-${opts.assigneeId}`,
      url:   '/chores',
    })

    if (expired.length > 0) {
      await db.from('push_subscriptions').delete().in('id', expired)
    }
  } catch (err) {
    console.error('[push] notifyAssigned error', err)
  }
}

/** Is this time within quiet hours? Both times are "HH:MM" 24-hour strings. */
export function isInQuietHours(
  quietStart: string | null,
  quietEnd:   string | null,
  nowUtc?: Date,
): boolean {
  if (!quietStart || !quietEnd) return false
  const now = nowUtc ?? new Date()
  const hhmm = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`
  if (quietStart <= quietEnd) {
    return hhmm >= quietStart && hhmm < quietEnd
  } else {
    // spans midnight e.g. 22:00 – 07:00
    return hhmm >= quietStart || hhmm < quietEnd
  }
}
