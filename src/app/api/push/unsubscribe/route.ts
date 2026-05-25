import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint?: string }

  if (endpoint) {
    // Remove a specific subscription (endpoint)
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  } else {
    // Remove ALL subscriptions for this user
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
