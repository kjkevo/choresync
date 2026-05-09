import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Service-role Supabase client.
 * Bypasses RLS — use ONLY in trusted server-side actions for privileged ops
 * such as deleting auth users. Never expose to the client.
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.'
    )
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
