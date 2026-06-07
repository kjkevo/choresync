import { redirect } from 'next/navigation'

export default async function LoginPage() {
  // Login/signup screens disabled — all entry points go to onboarding.
  // TODO: re-enable before launch
  redirect('/onboarding')
}
