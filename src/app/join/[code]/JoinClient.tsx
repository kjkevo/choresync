'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { joinViaLink } from '@/lib/actions/household'

interface Props {
  code:          string
  householdName: string | null
  memberCount:   number
}

export default function JoinClient({ code, householdName, memberCount }: Props) {
  const [name,       setName]       = useState('')
  const [focused,    setFocused]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [joined,     setJoined]     = useState<string | null>(null) // household name after joining
  const [isPending,  startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your display name.'); return }
    setError(null)
    setNeedsLogin(false)
    startTransition(async () => {
      const result = await joinViaLink(code, name.trim())
      if (result?.error) {
        if (result.error.toLowerCase().includes('sign in')) {
          setNeedsLogin(true)
        } else {
          setError(result.error)
        }
      } else {
        setJoined(householdName ?? 'your household')
      }
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (joined) {
    return (
      <>
        <style>{FONTS}</style>
        <div style={pageStyle}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 36px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 10px' }}>
              You&apos;re in!
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
              Welcome to <strong style={{ color: '#111827' }}>{joined}</strong>. Your household is ready.
            </p>
            <Link href="/dashboard" style={pillBtn}>
              Open ChoreSync →
            </Link>
          </div>
        </div>
      </>
    )
  }

  // ── Invalid code ───────────────────────────────────────────────────────────
  if (!householdName) {
    return (
      <>
        <style>{FONTS}</style>
        <div style={pageStyle}>
          <LogoRow />
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🔗</div>
            <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 8px' }}>
              Invalid invite link
            </h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
              This invite link has expired or doesn&apos;t exist. Ask your housemate for a new one.
            </p>
            <Link href="/dashboard" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              ← Go to dashboard
            </Link>
          </div>
        </div>
      </>
    )
  }

  // ── Main join form ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS}</style>
      <div style={pageStyle}>
        <LogoRow />

        <div style={cardStyle}>
          {/* Household info */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: '#FFF3EE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, margin: '0 auto 14px',
              border: '2px solid #FFD6BC',
            }}>
              🏠
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
              You&apos;ve been invited to join
            </p>
            <h1 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 24, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              {householdName}
            </h1>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {memberCount} member{memberCount !== 1 ? 's' : ''} already inside
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#F3F4F6', margin: '0 0 24px' }} />

          {/* Needs login prompt */}
          {needsLogin && (
            <div style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontFamily: '"Nunito", sans-serif',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1E40AF', fontWeight: 700 }}>
                You need to be signed in to join.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link
                  href={`/login?redirect=/join/${code}`}
                  style={{
                    flex: 1, textAlign: 'center', padding: '8px 0',
                    background: '#FF6B2B', color: '#fff', borderRadius: 99,
                    fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  }}
                >
                  Sign In
                </Link>
                <Link
                  href={`/signup?redirect=/join/${code}`}
                  style={{
                    flex: 1, textAlign: 'center', padding: '8px 0',
                    background: '#F3F4F6', color: '#374151', borderRadius: 99,
                    fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  }}
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: '#DC2626', fontWeight: 600,
              fontFamily: '"Nunito", sans-serif',
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: '"Nunito", sans-serif' }}>
                Your display name
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={60}
                autoFocus
                style={{
                  width: '100%', padding: '13px 16px',
                  fontSize: 15, fontFamily: '"Nunito", sans-serif', color: '#111827',
                  background: '#fff',
                  border: `1.5px solid ${focused ? '#FF6B2B' : '#E5E7EB'}`,
                  borderRadius: 12, outline: 'none', boxSizing: 'border-box',
                  boxShadow: focused ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', fontFamily: '"Nunito", sans-serif' }}>
                This is how your housemates will see you.
              </p>
            </div>

            <JoinButton loading={isPending} householdName={householdName} />
          </form>

          {/* Sign in link */}
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#9CA3AF', fontFamily: '"Nunito", sans-serif' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>

        {/* Invite code pill */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: '"Nunito", sans-serif' }}>
            Invite code:{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#374151', letterSpacing: '0.1em' }}>
              {code}
            </span>
          </span>
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: '#FFD166',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>🧹</div>
      <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', letterSpacing: '-0.3px' }}>
        ChoreSync
      </span>
    </div>
  )
}

function JoinButton({ loading, householdName }: { loading: boolean; householdName: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '14px',
        background: loading ? '#ffb347' : hovered ? '#e85a1f' : '#FF6B2B',
        color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 15, fontFamily: '"Poppins", sans-serif', fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 16px rgba(255,107,43,0.35)',
        opacity: loading ? 0.75 : 1,
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading ? 'Joining…' : `Join ${householdName}`}
    </button>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%)',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '32px 16px',
  fontFamily: '"Nunito", sans-serif',
}

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 440,
  background: '#fff', borderRadius: 20,
  padding: '32px 32px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.07)',
  border: '1px solid #F3F4F6',
}

const pillBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '13px 32px',
  background: '#FF6B2B', color: '#fff',
  borderRadius: 999, fontFamily: '"Poppins", sans-serif',
  fontWeight: 700, fontSize: 15, textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(255,107,43,0.35)',
}

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  ::placeholder { color: #9CA3AF; font-family: "Nunito", sans-serif; }
`
