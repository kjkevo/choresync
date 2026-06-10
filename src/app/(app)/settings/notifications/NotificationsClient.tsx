'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

interface PreferencesData {
  notification_chore_reminders: boolean
  notification_new_messages: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}

interface NotificationsClientProps {
  user: User
  preferences: PreferencesData
}

export default function NotificationsClient({ user, preferences: initialPrefs }: NotificationsClientProps) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<PreferencesData>(initialPrefs)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function savePreferences() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          notification_chore_reminders: prefs.notification_chore_reminders,
          notification_new_messages: prefs.notification_new_messages,
          quiet_hours_enabled: prefs.quiet_hours_enabled,
          quiet_hours_start: prefs.quiet_hours_start,
          quiet_hours_end: prefs.quiet_hours_end,
        } as any)
        .eq('id', user.id)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save preferences:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof PreferencesData) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleTimeChange = (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
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
            Notifications
          </span>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>
          {/* Success message */}
          {saved && (
            <div style={{
              background: '#D1FAE5', borderRadius: 12, padding: '10px 14px',
              fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 16,
            }}>
              ✅ Preferences saved!
            </div>
          )}

          {/* Chore reminders toggle */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: 16,
            marginBottom: 12, border: '0.5px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                  🔔 Chore Reminders
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                  Get notifications when a chore is due or overdue
                </p>
              </div>
              <button
                onClick={() => handleToggle('notification_chore_reminders')}
                style={{
                  width: 50, height: 28, borderRadius: 14, border: 'none',
                  background: prefs.notification_chore_reminders ? '#10B981' : '#D1D5DB',
                  cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background-color 0.3s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: prefs.notification_chore_reminders ? 24 : 2,
                  width: 24, height: 24, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.3s',
                }} />
              </button>
            </div>
          </div>

          {/* Messages toggle */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: 16,
            marginBottom: 12, border: '0.5px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                  💬 New Messages
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                  Get notified when someone sends you a message
                </p>
              </div>
              <button
                onClick={() => handleToggle('notification_new_messages')}
                style={{
                  width: 50, height: 28, borderRadius: 14, border: 'none',
                  background: prefs.notification_new_messages ? '#10B981' : '#D1D5DB',
                  cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background-color 0.3s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: prefs.notification_new_messages ? 24 : 2,
                  width: 24, height: 24, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.3s',
                }} />
              </button>
            </div>
          </div>

          {/* Quiet hours toggle and time pickers */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: 16,
            border: '0.5px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                  🌙 Quiet Hours
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                  Mute notifications during specific hours
                </p>
              </div>
              <button
                onClick={() => handleToggle('quiet_hours_enabled')}
                style={{
                  width: 50, height: 28, borderRadius: 14, border: 'none',
                  background: prefs.quiet_hours_enabled ? '#10B981' : '#D1D5DB',
                  cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background-color 0.3s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: prefs.quiet_hours_enabled ? 24 : 2,
                  width: 24, height: 24, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.3s',
                }} />
              </button>
            </div>

            {/* Time pickers (shown when enabled) */}
            {prefs.quiet_hours_enabled && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                    Start time
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={e => handleTimeChange('quiet_hours_start', e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #E5E7EB', fontSize: 14, fontFamily: '"Nunito", sans-serif',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                    End time
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={e => handleTimeChange('quiet_hours_end', e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #E5E7EB', fontSize: 14, fontFamily: '"Nunito", sans-serif',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={savePreferences}
            disabled={saving}
            style={{
              width: '100%', marginTop: 20, padding: '12px 16px', borderRadius: 10,
              border: 'none', background: '#FF6B2B', color: '#fff',
              fontSize: 14, fontWeight: 700, fontFamily: '"Nunito", sans-serif',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>

          {/* Info box */}
          <div style={{
            marginTop: 20, padding: 14, background: '#FEF3C7', borderRadius: 10,
            border: '1px solid #FCD34D',
          }}>
            <p style={{ fontSize: 11, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
              💡 <strong>Quiet hours</strong> will silence notifications between your selected times. You can still see messages and reminders when you open the app.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
