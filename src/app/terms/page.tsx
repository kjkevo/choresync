import type { Metadata } from 'next'
import Link from 'next/link'
import BackLink from '@/app/_components/BackLink'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
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
          background: 'linear-gradient(135deg, #FF6B2B 0%, #ffb347 100%)',
          borderRadius: 20, padding: '32px 36px', marginBottom: 32, color: '#fff',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 800,
            fontSize: 32, margin: '0 0 8px', color: '#fff',
          }}>
            Terms of Service
          </h1>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 15 }}>
            Last updated: May 2026
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using ChoreSync ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree with any part of these terms, you may not use the Service.
              These Terms apply to all users, including household administrators and members.
            </p>
          </Section>

          <Section title="2. Use of Service">
            <p>
              ChoreSync provides a household chore management platform that allows users to create,
              assign, and track household tasks. The Service is intended for personal, non-commercial
              household use. You agree to use the Service only for lawful purposes and in accordance
              with these Terms.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any
              time with reasonable notice. We are not liable to you or any third party for any
              modification, suspension, or discontinuation of the Service.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <p>
              To access most features, you must create an account. You are responsible for:
            </p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Promptly notifying us of any unauthorized use of your account</li>
              <li>Ensuring your account information is accurate and up to date</li>
            </ul>
            <p>
              You must be at least 13 years old to use ChoreSync. By creating an account, you confirm
              that you meet this age requirement.
            </p>
          </Section>

          <Section title="4. Household Data">
            <p>
              When you create or join a household on ChoreSync, you acknowledge that:
            </p>
            <ul>
              <li>All household members can view chores, activity feeds, and completion records</li>
              <li>Household administrators can manage chore assignments and member roles</li>
              <li>Content you submit (chore names, descriptions, completion photos) may be visible to
                other members of your household</li>
              <li>You are responsible for the accuracy of the data you enter</li>
            </ul>
          </Section>

          <Section title="5. Privacy">
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" style={{ color: '#FF6B2B', fontWeight: 600 }}>Privacy Policy</Link>,
              which is incorporated into these Terms by reference. Please review our Privacy Policy to
              understand our practices regarding the collection and use of your personal information.
            </p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose or in violation of any applicable laws</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
              <li>Upload or transmit viruses, malware, or other malicious code</li>
              <li>Scrape, crawl, or systematically extract data from the Service without written permission</li>
              <li>Impersonate any person or entity, or falsely state your affiliation with any person or entity</li>
              <li>Use the Service to send unsolicited communications (spam)</li>
            </ul>
          </Section>

          <Section title="7. Termination">
            <p>
              We reserve the right to suspend or terminate your account and access to the Service at
              our sole discretion, with or without cause, and with or without notice. You may also
              delete your account at any time from your profile settings. Upon termination, your right
              to use the Service ceases immediately.
            </p>
            <p>
              Provisions that by their nature should survive termination will survive, including
              Sections 5 (Privacy), 8 (Disclaimer), and 9 (Governing Law).
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF
              OR INABILITY TO USE THE SERVICE.
            </p>
          </Section>

          <Section title="9. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              United States, without regard to conflict of law principles. Any disputes arising
              under these Terms shall be resolved through binding arbitration or in the courts of
              competent jurisdiction in the United States.
            </p>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will revise the "Last
              updated" date at the top of this page. We encourage you to review these Terms
              periodically. Your continued use of the Service after changes constitutes your
              acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:support@choresync.app" style={{ color: '#FF6B2B', fontWeight: 600 }}>
                support@choresync.app
              </a>.
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
