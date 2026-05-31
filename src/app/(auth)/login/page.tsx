import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuthScreen from './AuthScreen'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}): Promise<Metadata> {
  const { tab } = await searchParams
  return { title: tab === 'signup' ? 'Sign Up | ChoreSync' : 'Sign In | ChoreSync' }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; redirectTo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Already signed in — go straight to dashboard
  if (user) redirect('/dashboard')

  const params = await searchParams
  const tab = params.tab === 'signup' ? 'signup' : 'login'
  const redirectTo = params.redirectTo ?? '/dashboard'

  return <AuthScreen initialTab={tab} redirectTo={redirectTo} />
}
