import type { Metadata } from 'next'
import AuthScreen from './AuthScreen'

// Dynamic title so the browser tab reflects which form is active on first load
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const isSignup = params.tab === 'signup'
  return {
    title: isSignup ? 'Sign Up | ChoreSync' : 'Sign In | ChoreSync',
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; redirectTo?: string }>
}) {
  const params = await searchParams
  const initialTab = (params.tab === 'signup' ? 'signup' : 'login') as 'login' | 'signup'
  const redirectTo = params.redirectTo ?? '/dashboard'
  return <AuthScreen initialTab={initialTab} redirectTo={redirectTo} />
}
