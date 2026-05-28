import type { Metadata } from 'next'
import AuthScreen from './AuthScreen'

export const metadata: Metadata = { title: 'Sign In' }

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
