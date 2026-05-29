import { permanentRedirect } from 'next/navigation'

// /signup is not the canonical route — all signup happens at /login?tab=signup
export default function SignupPage() {
  permanentRedirect('/login?tab=signup')
}
