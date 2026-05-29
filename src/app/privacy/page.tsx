import type { Metadata } from 'next'
import Link from 'next/link'
import BackLink from '@/app/_components/BackLink'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F8FA',
      fontFamily: "'Nunito', 'Inter', sans-serif",
      padding: '40px 20px 80px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Back link — returns to wherever the user came from */}
        <BackLink fallback="/login" />

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: 20, padding: '32px 36px', marginBottom: 32, color: '#fff',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 800,
            fontSize: 32, margin: '0 0 8px', color: '#fff',
          }}>
            Privacy Policy
          </h1>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 15 }}>
            Last updated: May 2026
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <Section title="Overview">
            <p>
              ChoreSync ("we", "us", or "our") is committed to protecting your privacy. This Privacy
              Policy explains how we collect, use, store, and share information when you use our
              household chore management service. We designed ChoreSync with privacy in mind and only
              collect data necessary to operate the service.
            </p>
          </Section>

          <Section title="1. Information We Collect">
            <p><strong>Account Information</strong></p>
            <ul>
              <li>Name and email address (provided during sign-up or via OAuth)</li>
              <li>Profile photo (optional, if you choose to upload one)</li>
              <li>Authentication provider details (if you sign in with Google or Apple)</li>
            </ul>

            <p><strong>Household Data</strong></p>
            <ul>
              <li>Household name and membership information</li>
              <li>Chore names, descriptions, due dates, frequencies, and assignments</li>
              <li>Chore completion records, including timestamps and completion photos (if uploaded)</li>
              <li>Announcements and pinned messages within your household</li>
              <li>Points, streaks, and activity history</li>
            </ul>

            <p><strong>Push Notifications</strong></p>
            <ul>
              <li>Push notification subscription tokens (if you opt in to notifications)</li>
            </ul>

            <p><strong>Usage Data</strong></p>
            <ul>
              <li>Basic analytics such as feature usage patterns and error logs to improve the service</li>
              <li>IP address and browser/device type for security and fraud prevention</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul>
              <li>Operate and deliver the ChoreSync service, including syncing chores across household members</li>
              <li>Send push notifications for chore reminders, completions, and household updates (only if you opt in)</li>
              <li>Authenticate your identity and maintain account security</li>
              <li>Respond to support requests and communicate service updates</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Improve the service through aggregated, anonymized analytics</li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal data to third parties. We do not use your
              data for targeted advertising.
            </p>
          </Section>

          <Section title="3. Data Storage and Security">
            <p>
              Your data is stored securely using <strong>Supabase</strong>, a managed database and
              authentication platform. Data is stored on servers located in the <strong>United States</strong>.
              Supabase implements industry-standard security measures including encryption at rest and
              in transit (TLS).
            </p>
            <p>
              We implement access controls so that only authorized household members can view
              household-specific data. We regularly review our security practices and apply updates
              as needed. However, no system is completely secure — if you believe your account has
              been compromised, contact us immediately.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p>We share your data only in the following limited circumstances:</p>
            <ul>
              <li>
                <strong>Within your household:</strong> Household members can see chore assignments,
                completion records, activity feeds, and member profiles as part of normal service operation.
              </li>
              <li>
                <strong>Service providers:</strong> We use Supabase for database and authentication
                services, and may use other trusted providers for push notifications and file storage.
                These providers are contractually bound to protect your data.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose data if required by law, court
                order, or to protect the rights and safety of users or the public.
              </li>
            </ul>
          </Section>

          <Section title="5. Your Rights (GDPR / CCPA)">
            <p>
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Ask us to correct inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request that we delete your account and associated data.
                You can initiate account deletion from your profile settings, or contact us directly.</li>
              <li><strong>Export:</strong> Request an export of your data in a machine-readable format.</li>
              <li><strong>Opt-out:</strong> Opt out of non-essential communications at any time.</li>
              <li><strong>Restrict processing:</strong> Request that we limit how we process your data in certain circumstances.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@choresync.app" style={{ color: '#6366f1', fontWeight: 600 }}>
                privacy@choresync.app
              </a>. We will respond within 30 days.
            </p>
          </Section>

          <Section title="6. Cookies and Local Storage">
            <p>
              ChoreSync uses session cookies and browser local storage strictly for authentication
              and user preferences (such as theme settings). We do not use third-party tracking
              cookies or advertising cookies.
            </p>
            <ul>
              <li><strong>Session cookies:</strong> Used to keep you logged in during your session.</li>
              <li><strong>Local storage:</strong> Used to remember your theme preference (light/dark)
                and language settings. This data never leaves your device.</li>
            </ul>
          </Section>

          <Section title="7. Data Retention">
            <p>
              We retain your personal data for as long as your account is active. If you delete your
              account, we will delete your personal data within 30 days, except where we are required
              to retain it for legal obligations. Anonymized, aggregated usage data may be retained
              indefinitely for analytical purposes.
            </p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              ChoreSync is not directed at children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe a child under 13 has
              provided us with personal information, please contact us so we can delete it.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we
              will update the "Last updated" date and, where appropriate, notify you via email or
              in-app notification. Your continued use of ChoreSync after changes take effect constitutes
              your acceptance of the revised policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or your
              personal data, please contact us:
            </p>
            <ul>
              <li>
                Email:{' '}
                <a href="mailto:privacy@choresync.app" style={{ color: '#6366f1', fontWeight: 600 }}>
                  privacy@choresync.app
                </a>
              </li>
              <li>
                General support:{' '}
                <a href="mailto:support@choresync.app" style={{ color: '#6366f1', fontWeight: 600 }}>
                  support@choresync.app
                </a>
              </li>
            </ul>
            <p>
              You may also review our{' '}
              <Link href="/terms" style={{ color: '#6366f1', fontWeight: 600 }}>Terms of Service</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #F0F0F0', padding: '24px 28px',
    }}>
      <h2 style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 700,
        fontSize: 17, color: '#111827', margin: '0 0 12px',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}
