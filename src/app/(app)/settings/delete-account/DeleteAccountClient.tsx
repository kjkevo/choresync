'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAccount } from '@/lib/actions/settings'
import type { User } from '@supabase/supabase-js'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

interface DeleteAccountClientProps {
  user: User
}

export default function DeleteAccountClient({ user }: DeleteAccountClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<'warning' | 'confirm'>('warning')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const userEmail = user.email || ''
  const canProceed = confirmEmail === userEmail && step === 'confirm'

  const handleDelete = async () => {
    if (!canProceed) return

    setLoading(true)
    setError('')

    try {
      await deleteAccount()
      // deleteAccount redirects to /login, so this won't execute
      // but keeping it for safety
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setLoading(false)
    }
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
            onClick={() => {
              if (step === 'confirm') {
                setStep('warning')
                setConfirmEmail('')
              } else {
                router.back()
              }
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B2B',
              fontWeight: 800, fontSize: 14, fontFamily: '"Nunito", sans-serif',
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}
            aria-label="Go back"
          >
            ← Back
          </button>
          <span style={{
            fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 16, color: '#111827',
          }}>
            Delete Account
          </span>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 40px' }}>

          {step === 'warning' && (
            <>
              {/* Warning box */}
              <div style={{
                background: '#FEE2E2', borderRadius: 12, padding: 16, marginBottom: 24,
                border: '1px solid #FECACA',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 24 }}>⚠️</div>
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#7F1D1D', marginBottom: 6,
                    }}>
                      This action cannot be undone
                    </div>
                    <p style={{
                      fontSize: 13, color: '#991B1B', margin: 0, lineHeight: 1.5,
                    }}>
                      Deleting your account will permanently remove all your data from ChoreSync. This includes your profile, all chore history, points, streaks, badges, and household membership.
                    </p>
                  </div>
                </div>
              </div>

              {/* What happens */}
              <div style={{
                background: '#fff', borderRadius: 12, padding: 20, marginBottom: 24,
                border: '0.5px solid #E5E7EB',
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12,
                }}>
                  What will be deleted:
                </div>
                <ul style={{
                  margin: 0, padding: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.8,
                }}>
                  <li style={{ marginBottom: 8 }}>
                    <span style={{ color: '#EF4444' }}>●</span> Your profile and account information
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <span style={{ color: '#EF4444' }}>●</span> All chore completion history
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <span style={{ color: '#EF4444' }}>●</span> Points, streaks, and badges
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <span style={{ color: '#EF4444' }}>●</span> Household membership
                  </li>
                  <li style={{ marginBottom: 8 }}>
                    <span style={{ color: '#EF4444' }}>●</span> Messages and notifications
                  </li>
                  <li>
                    <span style={{ color: '#EF4444' }}>●</span> All personal data stored in Supabase
                  </li>
                </ul>
              </div>

              {/* Info box */}
              <div style={{
                background: '#F0F9FF', borderRadius: 12, padding: 14, marginBottom: 24,
                border: '1px solid #BAE6FD',
              }}>
                <p style={{
                  fontSize: 12, color: '#0369A1', margin: 0, lineHeight: 1.5,
                }}>
                  💡 <strong>Note:</strong> Other household members will still be able to see chores you previously completed and assigned, but your name will be associated with those records.
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => setStep('confirm')}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  border: 'none', background: '#EF4444', color: '#fff',
                  fontSize: 14, fontWeight: 700, fontFamily: '"Nunito", sans-serif',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#DC2626'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#EF4444'
                }}
              >
                I understand, delete my account
              </button>

              {/* Cancel button */}
              <button
                onClick={() => router.back()}
                style={{
                  width: '100%', marginTop: 12, padding: '12px 16px', borderRadius: 10,
                  border: '0.5px solid #E5E7EB', background: '#fff', color: '#111827',
                  fontSize: 14, fontWeight: 700, fontFamily: '"Nunito", sans-serif',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#fff'
                }}
              >
                Cancel
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              {/* Confirmation step */}
              <div style={{
                background: '#fff', borderRadius: 12, padding: 24,
                border: '0.5px solid #E5E7EB', marginBottom: 24,
              }}>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 12,
                }}>
                  Confirm account deletion
                </div>
                <p style={{
                  fontSize: 13, color: '#6B7280', margin: '0 0 16px',
                  lineHeight: 1.5,
                }}>
                  To confirm, please type your email address exactly:
                </p>

                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6,
                  }}>
                    Your email
                  </div>
                  <div style={{
                    padding: '10px 12px', background: '#F3F4F6', borderRadius: 8,
                    fontSize: 13, color: '#6B7280', fontFamily: 'monospace',
                  }}>
                    {userEmail}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    fontSize: 12, fontWeight: 600, color: '#374151', display: 'block',
                    marginBottom: 6,
                  }}>
                    Type your email to confirm
                  </label>
                  <input
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={userEmail}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #E5E7EB', fontSize: 13,
                      fontFamily: '"Nunito", sans-serif',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16,
                    fontSize: 12, color: '#991B1B', border: '1px solid #FECACA',
                  }}>
                    {error}
                  </div>
                )}

                {/* Delete button */}
                <button
                  onClick={handleDelete}
                  disabled={!canProceed || loading}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: 'none', background: canProceed && !loading ? '#EF4444' : '#D1D5DB',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    fontFamily: '"Nunito", sans-serif',
                    cursor: canProceed && !loading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (canProceed && !loading) {
                      (e.currentTarget as HTMLElement).style.background = '#DC2626'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canProceed && !loading) {
                      (e.currentTarget as HTMLElement).style.background = '#EF4444'
                    }
                  }}
                >
                  {loading ? 'Deleting account…' : 'Delete my account permanently'}
                </button>

                {/* Back button */}
                <button
                  onClick={() => {
                    setStep('warning')
                    setConfirmEmail('')
                    setError('')
                  }}
                  disabled={loading}
                  style={{
                    width: '100%', marginTop: 12, padding: '12px 16px', borderRadius: 10,
                    border: '0.5px solid #E5E7EB', background: '#fff', color: '#111827',
                    fontSize: 14, fontWeight: 700, fontFamily: '"Nunito", sans-serif',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLElement).style.background = '#F9FAFB'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLElement).style.background = '#fff'
                    }
                  }}
                >
                  Back
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
