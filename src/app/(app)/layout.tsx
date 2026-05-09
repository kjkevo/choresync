import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'

/**
 * Root layout for all authenticated app pages.
 *
 * Guards:
 *  1. Unauthenticated → /login
 *  2. Authenticated but no household → /onboarding
 *     (exempts /onboarding itself so it doesn't infinite-loop)
 *
 * Wraps every app page in ThemeProvider so dark-mode state is available
 * to any Client Component in the tree.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <ThemeProvider>{children}</ThemeProvider>
}
