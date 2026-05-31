import { permanentRedirect } from 'next/navigation'

/** Rankings have moved into the Dashboard. */
export default function LeaderboardPage() {
  permanentRedirect('/dashboard')
}
