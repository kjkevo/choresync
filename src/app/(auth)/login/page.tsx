import { redirect } from 'next/navigation'

// Auth screen is temporarily disabled — send everyone straight to the dashboard
export default function LoginPage() {
  redirect('/dashboard')
}
