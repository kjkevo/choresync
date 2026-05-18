'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────
const ORANGE  = '#FF6B2B'
const YELLOW  = '#FFD166'
const GRAY_BG = '#F3F4F6'
const BORDER  = '#E5E7EB'
const MUTED   = '#9CA3AF'

// ─── Shared input style ───────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: '100%',
  border: `1.5px solid ${BORDER}`,
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 15,
  fontFamily: 'var(--font-nunito), sans-serif',
  color: '#111827',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  WebkitAppearance: 'none',
}

function useFocusStyle() {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = ORANGE
      e.currentTarget.style.boxShadow   = `0 0 0 3px rgba(255,107,43,0.15)`
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = BORDER
      e.currentTarget.style.boxShadow   = 'none'
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [showPw, setShowPw]          = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [done, setDone]              = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const focus = useFocusStyle()

  // ── Google OAuth ─────────────────────────────────────────────────────────
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

  // ── Email submit ─────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd        = new FormData(e.currentTarget)
    const firstName = (fd.get('firstName') as string).trim()
    const lastName  = (fd.get('lastName')  as string).trim()
    const password  = fd.get('password')  as string

    if (!firstName)        { setError('First name is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    // Build fullName for the existing signUp action
    fd.set('fullName', lastName ? `${firstName} ${lastName}` : firstName)
    // confirmPassword not required here — handled downstream
    fd.set('confirmPassword', password)

    startTransition(async () => {
      const result = await signUp(fd)
      if (result?.error) setError(result.error)
      else setDone(true)
    })
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <Page>
        <Card>
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontFamily: 'var(--font-poppins)', fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Check your inbox
            </h2>
            <p style={{ fontFamily: 'var(--font-nunito)', fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
              We sent a confirmation link to your email. Click it to activate your account and get started.
            </p>
            <Link
              href="/login"
              style={{ fontFamily: 'var(--font-nunito)', color: ORANGE, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
            >
              Back to sign in →
            </Link>
          </div>
        </Card>
      </Page>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <Page>
      <Card>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: YELLOW,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            🧹
          </div>
          <span style={{ fontFamily: 'var(--font-poppins)', fontWeight: 800, fontSize: 22, color: '#111827', letterSpacing: '-0.3px' }}>
            ChoreSync
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-nunito)', fontSize: 13, color: MUTED, marginBottom: 28, marginTop: 6 }}>
          Sign Up — Step 1 of 3
        </p>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginBottom: 18,
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 10, padding: '10px 14px',
            fontFamily: 'var(--font-nunito)', fontSize: 13, color: '#DC2626',
          }} role="alert">
            {error}
          </div>
        )}

        {/* ── Continue with Google ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || isPending}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: `1.5px solid ${BORDER}`,
            borderRadius: 12, padding: '12px 18px',
            background: '#fff',
            fontFamily: 'var(--font-nunito)', fontWeight: 700, fontSize: 15, color: '#374151',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            marginBottom: 20,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER;    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
        >
          <span>{googleLoading ? 'Redirecting…' : 'Continue with Google'}</span>
          {googleLoading ? <Spinner /> : <GoogleIcon />}
        </button>

        {/* ── OR divider ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontFamily: 'var(--font-nunito)', fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: '0.08em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>First name</Label>
              <input
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="Alex"
                required
                style={{ ...inputBase }}
                {...focus}
              />
            </div>
            <div>
              <Label>Last name <span style={{ color: MUTED, fontWeight: 500 }}>(optional)</span></Label>
              <input
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Johnson"
                style={{ ...inputBase }}
                {...focus}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <Label>Username</Label>
            <input
              name="username"
              type="text"
              autoComplete="username"
              placeholder="@alex_johnson"
              required
              style={{ ...inputBase }}
              {...focus}
            />
            <HelperText>You can change this later</HelperText>
          </div>

          {/* Email (hidden label, needed for signUp action) */}
          <div>
            <Label>Email address</Label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              style={{ ...inputBase }}
              {...focus}
            />
          </div>

          {/* Password */}
          <div>
            <Label>Password</Label>
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                required
                style={{ ...inputBase, paddingRight: 48 }}
                {...focus}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: MUTED, padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <HelperText>Must be at least 8 characters</HelperText>
          </div>

          {/* ToS text */}
          <p style={{
            fontFamily: 'var(--font-nunito)', fontSize: 12, color: '#6B7280',
            lineHeight: 1.6, textAlign: 'center', marginTop: 4,
          }}>
            By tapping Agree and Continue you agree to our{' '}
            <Link href="/terms"   style={{ color: ORANGE, fontWeight: 700, textDecoration: 'none' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: ORANGE, fontWeight: 700, textDecoration: 'none' }}>Privacy Policy</Link>
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || googleLoading}
            style={{
              width: '100%',
              background: isPending ? '#ffb399' : ORANGE,
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '14px 24px',
              fontFamily: 'var(--font-poppins)', fontWeight: 700, fontSize: 15,
              cursor: isPending ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(255,107,43,0.35)',
              transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = '#e85a1f' }}
            onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = ORANGE  }}
            onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
            onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            {isPending && <Spinner />}
            {isPending ? 'Creating account…' : 'Agree and Continue'}
          </button>

        </form>

        {/* Sign-in link */}
        <p style={{ fontFamily: 'var(--font-nunito)', fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: ORANGE, fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
        </p>

      </Card>
    </Page>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: GRAY_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', maxWidth: 480,
      background: '#fff',
      borderRadius: 20,
      padding: '36px 36px 32px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', marginBottom: 6,
      fontFamily: 'var(--font-nunito)', fontWeight: 700, fontSize: 13, color: '#374151',
    }}>
      {children}
    </label>
  )
}

function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-nunito)', fontSize: 12, color: MUTED, marginTop: 5 }}>
      {children}
    </p>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
