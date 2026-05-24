'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw]          = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [done, setDone]              = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [focused, setFocused]        = useState<string | null>(null)

  async function handleGoogle() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        scopes: 'profile email',
      },
    })
    setGoogleLoading(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd        = new FormData(e.currentTarget)
    const firstName = (fd.get('firstName') as string).trim()
    const lastName  = (fd.get('lastName')  as string).trim()
    const password  = fd.get('password')   as string

    if (!firstName)          { setError('First name is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    fd.set('fullName', lastName ? `${firstName} ${lastName}` : firstName)
    fd.set('confirmPassword', password)

    startTransition(async () => {
      const result = await signUp(fd)
      if (result?.error) setError(result.error)
      else setDone(true)
    })
  }

  const inp = (name: string): React.CSSProperties => ({
    width: '100%',
    padding: '13px 16px',
    fontSize: 15,
    fontFamily: '"Nunito", sans-serif',
    color: '#111827',
    background: '#fff',
    border: `1.5px solid ${focused === name ? '#FF6B2B' : '#E5E7EB'}`,
    borderRadius: 12,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: focused === name ? '0 0 0 3px rgba(255,107,43,0.13)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    appearance: 'none',
    WebkitAppearance: 'none',
  })

  const fo = (name: string) => () => setFocused(name)
  const bl = ()              => setFocused(null)

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (done) {
    return (
      <>
        <style>{fonts}</style>
        <div style={pageWrap}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✉️</div>
            <h2 style={{ fontFamily: '"Poppins", sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>Check your inbox</h2>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.75, margin: '0 0 28px' }}>
              We sent a confirmation link to your email address. Click it to activate your ChoreSync account.
            </p>
            <Link href="/login" style={{ color: '#FF6B2B', fontWeight: 700, fontFamily: '"Poppins", sans-serif', textDecoration: 'none', fontSize: 15 }}>
              Back to sign in →
            </Link>
          </div>
        </div>
      </>
    )
  }

  /* ── Main form ──────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{fonts}</style>

      <div style={pageWrap}>
        <div style={card}>

          {/* ── Card header ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: '#FFD166',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                🧹
              </div>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', letterSpacing: '-0.3px' }}>
                ChoreSync
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', fontFamily: '"Nunito", sans-serif', fontWeight: 600 }}>
              Sign Up — Step 1 of 3
            </p>
          </div>

          {/* ── Error banner ──────────────────────────────────────────────── */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, padding: '11px 15px',
              marginBottom: 20, fontSize: 13,
              color: '#DC2626', fontFamily: '"Nunito", sans-serif', fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {/* ── Continue with Google ──────────────────────────────────────── */}
          <GoogleButton loading={googleLoading} disabled={isPending} onClick={handleGoogle} />

          {/* ── OR divider ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', fontFamily: '"Nunito", sans-serif' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          </div>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input
                  name="firstName" type="text" autoComplete="given-name"
                  placeholder="Alex" required
                  style={inp('firstName')} onFocus={fo('firstName')} onBlur={bl}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Last name{' '}
                  <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: 12 }}>(optional)</span>
                </label>
                <input
                  name="lastName" type="text" autoComplete="family-name"
                  placeholder="Johnson"
                  style={inp('lastName')} onFocus={fo('lastName')} onBlur={bl}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label style={labelStyle}>Username</label>
              <input
                name="username" type="text" autoComplete="username"
                placeholder="@alex_j" required
                style={inp('username')} onFocus={fo('username')} onBlur={bl}
              />
              <p style={helperStyle}>You can change this later</p>
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password" type={showPw ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Min. 8 characters" required
                  style={{ ...inp('password'), paddingRight: 46 }}
                  onFocus={fo('password')} onBlur={bl}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 13, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: '#9CA3AF',
                    padding: 0, display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <p style={helperStyle}>Must be at least 8 characters</p>
            </div>

            {/* ToS */}
            <p style={{
              fontSize: 12, color: '#9CA3AF', textAlign: 'center',
              lineHeight: 1.75, margin: '2px 0 0',
              fontFamily: '"Nunito", sans-serif',
            }}>
              By tapping Agree and Continue you agree to our{' '}
              <Link href="/terms" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none' }}>
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="/privacy" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none' }}>
                Privacy Policy
              </Link>
            </p>

            {/* Submit */}
            <AgreeButton loading={isPending || googleLoading} />
          </form>

          {/* ── Sign in link ──────────────────────────────────────────────── */}
          <p style={{ marginTop: 22, textAlign: 'center', fontSize: 14, color: '#6B7280', fontFamily: '"Nunito", sans-serif' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#FF6B2B', fontWeight: 700, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function GoogleButton({ loading, disabled, onClick }: { loading: boolean; disabled: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 18px',
        border: `1.5px solid ${hovered ? '#D1D5DB' : '#E5E7EB'}`,
        borderRadius: 12,
        background: '#fff',
        fontSize: 15,
        fontFamily: '"Nunito", sans-serif',
        fontWeight: 700,
        color: '#374151',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
        opacity: disabled && !loading ? 0.6 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
      {loading ? <Spinner color="#9CA3AF" /> : <GoogleIcon />}
    </button>
  )
}

function AgreeButton({ loading }: { loading: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '15px',
        background: loading ? '#ffb347' : hovered ? '#e85a1f' : '#FF6B2B',
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        fontSize: 15,
        fontFamily: '"Poppins", sans-serif',
        fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: loading ? 'none' : '0 4px 16px rgba(255,107,43,0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: loading ? 0.75 : 1,
        transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s',
        marginTop: 4,
        letterSpacing: '0.01em',
      }}
    >
      {loading && <Spinner color="#fff" />}
      {loading ? 'Creating account…' : 'Agree and Continue'}
    </button>
  )
}

/* ── Shared styles ───────────────────────────────────────────────────────────── */

const pageWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: '#F3F4F6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  fontFamily: '"Nunito", sans-serif',
}

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: '#fff',
  borderRadius: 20,
  padding: '36px 36px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.07)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 7,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  fontFamily: '"Nunito", sans-serif',
}

const helperStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 12,
  color: '#9CA3AF',
  fontFamily: '"Nunito", sans-serif',
}

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::placeholder { color: #9CA3AF !important; font-family: "Nunito", sans-serif; }
  input { font-family: "Nunito", sans-serif; }
`

/* ── Icons ───────────────────────────────────────────────────────────────────── */

function Spinner({ color = '#fff' }: { color?: string }) {
  return (
    <svg
      style={{ width: 16, height: 16, animation: 'cs-spin 0.75s linear infinite', flexShrink: 0 }}
      viewBox="0 0 24 24" fill="none"
    >
      <style>{`@keyframes cs-spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}
