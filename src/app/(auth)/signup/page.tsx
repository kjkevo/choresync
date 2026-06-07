import { redirect } from 'next/navigation'

// Signup screen disabled — all entry points go to onboarding.
// TODO: re-enable before launch
export default function SignupPage() {
  redirect('/onboarding')
}
