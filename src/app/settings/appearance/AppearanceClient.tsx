'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

type AppearanceMode = 'light' | 'dark' | 'system'

interface AppearanceClientProps {
  user: User
}

const APPEARANCE_OPTIONS: Array<{ value: AppearanceMode; label: string; icon: string; description: string }> = [
  {
    value: 'light',
    label: 'Light mode',
    icon: '☀️',
    description: 'Always use light theme',
  },
  {
    value: 'dark',
    label: 'Dark mode',
    icon: '🌙',
    description: 'Always use dark theme',
  },
  {
    value: 'system',
    label: 'System default',
    icon: '🖥️',
    description: 'Follow your device settings',
  },
]

export default function AppearanceClient({ user }: AppearanceClientProps) {
  const router = useRouter()
  const [appearance, setAppearance] = useState<AppearanceMode>('system')
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cs_appearance') as AppearanceMode | null
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setAppearance(saved)
    }
    setMounted(true)
  }, [])

  const handleChange = (mode: AppearanceMode) => {
    setAppearance(mode)
    localStorage.setItem('cs_appearance', mode)

    // Apply theme immediately
    applyTheme(mode)
  }

  const applyTheme = (mode: AppearanceMode) => {
    const html = document.documentElement

    if (mode === 'system') {
      // Use system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      html.style.colorScheme = isDark ? 'dark' : 'light'
      html.classList.toggle('dark', isDark)
    } else {
      // Use explicit preference
      html.style.colorScheme = mode
      html.classList.toggle('dark', mode === 'dark')
    }
  }

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

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
            Appearance
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
              💡 Choose how ChoreSync looks. Your preference is saved locally.
            </p>
          </div>

          {/* Radio button options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {APPEARANCE_OPTIONS.map(option => (
              <label
                key={option.value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 14, borderRadius: 12, background: '#fff',
                  border: appearance === option.value ? '2px solid #FF6B2B' : '1px solid #E5E7EB',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (appearance !== option.value) {
                    (e.currentTarget as HTMLElement).style.borderColor = '#FFB8A3'
                    ;(e.currentTarget as HTMLElement).style.background = '#FFF8F5'
                  }
                }}
                onMouseLeave={e => {
                  if (appearance !== option.value) {
                    (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'
                    ;(e.currentTarget as HTMLElement).style.background = '#fff'
                  }
                }}
              >
                {/* Radio button */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                  borderColor: appearance === option.value ? '#FF6B2B' : '#D1D5DB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {appearance === option.value && (
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: '#FF6B2B',
                    }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                    {option.icon} {option.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {option.description}
                  </div>
                </div>

                {/* Checkmark for selected */}
                {appearance === option.value && (
                  <div style={{ fontSize: 18, color: '#FF6B2B' }}>
                    ✓
                  </div>
                )}

                {/* Hidden radio button for accessibility */}
                <input
                  type="radio"
                  name="appearance"
                  value={option.value}
                  checked={appearance === option.value}
                  onChange={() => handleChange(option.value)}
                  style={{ display: 'none' }}
                />
              </label>
            ))}
          </div>

          {/* Preview section */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12, margin: '24px 0 12px' }}>
              Preview
            </h3>
            <div style={{
              display: 'flex', gap: 12,
              background: appearance === 'dark' ? '#1F2937' : '#F9FAFB',
              padding: 16, borderRadius: 12, border: '1px solid',
              borderColor: appearance === 'dark' ? '#374151' : '#E5E7EB',
            }}>
              <div style={{
                flex: 1, padding: 12, borderRadius: 8,
                background: appearance === 'dark' ? '#111827' : '#fff',
                color: appearance === 'dark' ? '#F3F4F6' : '#111827',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Sample text
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  This is how the app will look with your selection.
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div style={{
            marginTop: 20, padding: 14, background: '#FEF3C7', borderRadius: 10,
            border: '1px solid #FCD34D',
          }}>
            <p style={{ fontSize: 11, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
              💡 <strong>System default</strong> will automatically switch between light and dark based on your device's settings at different times of day.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
