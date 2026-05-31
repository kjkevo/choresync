import { permanentRedirect } from 'next/navigation'

/** Custom chore creation has moved into the Profile tab. */
export default function CustomPage() {
  permanentRedirect('/profile')
}
