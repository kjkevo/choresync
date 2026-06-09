'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changePassword } from '@/lib/actions/auth'
import type { User } from '@supabase/supabase-js'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

interface ChangePasswordClientProps {
  user: User
}

export default function ChangePasswordClient({ user }: ChangePasswordClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    // Client-side validation
    if (!currentPassword.trim()) {
      setErrorMsg('Current password is required')
      return
    }
    if (!newPassword.trim()) {
      setErrorMsg('New password is required')
      return
    }
    if (!confirmPassword.trim()) {
      setErrorMsg('Password confirmation is required')
      return
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      setErrorMsg('New password must be different from current password')
      return
    }

    const fd = new FormData()
    fd.append('currentPassword', currentPassword)
    fd.append('newPassword', newPassword)
    fd.append('confirmPassword', confirmPassword)

    startTransition(async () => {
      const r = await changePassword(fd)
      if (r?.error) {
        setErrorMsg(r.error)
      } else {
        setSuccessMsg(r.message || 'Password changed successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          router.push('/profile')
        }, 2000)
      }
    })
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
            Change password
          </span>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 40px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Current password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                Current password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  disabled={isPending}
                  style={{
                    width: '100%', padding: '12px 40px 12px 12px', fontSize: 14,
                    border: '1px solid #E5E7EB', borderRadius: 8,
                    fontFamily: '"Nunito", sans-serif',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#FF6B2B'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                  aria-label={showPasswords ? 'Hide password' : 'Show password'}
                >
                  {showPasswords ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                New password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter a new password (min 6 characters)"
                disabled={isPending}
                style={{
                  width: '100%', padding: '12px', fontSize: 14,
                  border: '1px solid #E5E7EB', borderRadius: 8,
                  fontFamily: '"Nunito", sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#FF6B2B'}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
              />
              {newPassword.length > 0 && (
                <p style={{ fontSize: 11, color: newPassword.length >= 6 ? '#10B981' : '#F59E0B', margin: '4px 0 0' }}>
                  {newPassword.length}/6 characters {newPassword.length >= 6 ? '✓' : ''}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                Confirm password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                disabled={isPending}
                style={{
                  width: '100%', padding: '12px', fontSize: 14,
                  border: '1px solid #E5E7EB', borderRadius: 8,
                  fontFamily: '"Nunito", sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#FF6B2B'}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
              />
              {confirmPassword.length > 0 && newPassword === confirmPassword && (
                <p style={{ fontSize: 11, color: '#10B981', margin: '4px 0 0' }}>
                  Passwords match ✓
                </p>
              )}
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                background: '#FEE2E2', borderRadius: 12, padding: '10px 14px',
                fontSize: 13, fontWeight: 700, color: '#991B1B',
              }}>
                ❌ {errorMsg}
              </div>
            )}

            {/* Success message */}
            {successMsg && (
              <div style={{
                background: '#D1FAE5', borderRadius: 12, padding: '10px 14px',
                fontSize: 13, fontWeight: 700, color: '#065F46',
              }}>
                ✅ {successMsg}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
              style={{
                background: '#FF6B2B', color: '#fff', border: 'none', borderRadius: 14,
                padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: '"Nunito", sans-serif',
                opacity: (isPending || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) ? 0.5 : 1,
                transition: 'opacity 0.2s',
                width: '100%',
                marginTop: 8,
              }}
            >
              {isPending ? 'Updating password…' : 'Change password'}
            </button>
          </form>

          {/* Info box */}
          <div style={{
            marginTop: 24, padding: 16, background: '#FFF3EE', borderRadius: 12,
            border: '1px solid #FCDDD7',
          }}>
            <p style={{ fontSize: 12, color: '#633806', margin: 0, lineHeight: 1.5 }}>
              💡 <strong>For your security:</strong> You'll need to re-enter your current password to confirm this change. After updating, you'll be logged out and can log in with your new password.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
