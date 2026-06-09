'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

interface SettingsClientProps {
  user: User
}

interface SettingOption {
  icon: string
  title: string
  description: string
  action: () => void
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter()
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>(
    (localStorage.getItem('cs_appearance') as any) ?? 'system'
  )

  const settings: SettingOption[] = [
    {
      icon: '🔔',
      title: 'Notifications',
      description: 'Manage alerts and notification preferences',
      action: () => {
        router.push('/settings/notifications')
      },
    },
    {
      icon: '🌙',
      title: 'Appearance',
      description: `Current: ${appearance === 'system' ? 'System default' : appearance === 'dark' ? 'Dark mode' : 'Light mode'}`,
      action: () => {
        // Toggle appearance setting
        const next = appearance === 'light' ? 'dark' : appearance === 'dark' ? 'system' : 'light'
        setAppearance(next)
        localStorage.setItem('cs_appearance', next)
      },
    },
    {
      icon: '🌐',
      title: 'Language & Region',
      description: 'English · US',
      action: () => {
        // Future: navigate to language settings
        alert('Language settings coming soon!')
      },
    },
    {
      icon: '🔒',
      title: 'Change Password',
      description: 'Update your login credentials',
      action: () => {
        router.push('/settings/change-password')
      },
    },
    {
      icon: '📅',
      title: 'Calendar Sync',
      description: 'Connect Google Calendar',
      action: () => {
        // Future: implement calendar sync
        alert('Calendar sync coming soon!')
      },
    },
    {
      icon: '🛡️',
      title: 'Privacy & Data',
      description: 'Export or delete your data',
      action: () => {
        router.push('/privacy')
      },
    },
  ]

  return (
    <>
      <style>{FONTS}</style>
      <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif' }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, background: '#fff',
          borderBottom: '0.5px solid #E5E7EB', padding: '0 16px', height: 52,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B2B', fontWeight: 800, fontSize: 14, fontFamily: '"Nunito", sans-serif', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            aria-label="Go back"
          >
            ← Back
          </button>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 16, color: '#111827' }}>
            Settings
          </span>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>
          {/* Info card */}
          <div style={{
            background: '#F0F9FF', borderRadius: 12, padding: 14,
            border: '1px solid #BAE6FD', marginBottom: 20,
          }}>
            <p style={{ fontSize: 12, color: '#0369A1', margin: 0, lineHeight: 1.5 }}>
              💡 Configure your ChoreSync preferences below. Some settings are coming soon!
            </p>
          </div>

          {/* Settings list */}
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '0.5px solid #E5E7EB' }}>
            {settings.map((setting, idx) => (
              <button
                key={idx}
                onClick={setting.action}
                style={{
                  width: '100%', textAlign: 'left', padding: '14px 16px',
                  borderBottom: idx < settings.length - 1 ? '0.5px solid #E5E7EB' : 'none',
                  background: '#fff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#F9FAFB'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '#fff'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, background: '#F3F4F6',
                }}>
                  {setting.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                    {setting.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {setting.description}
                  </div>
                </div>

                {/* Chevron */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* App info */}
          <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 40 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
              ChoreSync v1.0.0<br />
              Built with ❤️ for better households
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
