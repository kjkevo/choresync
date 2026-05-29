'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { sendPasswordReset } from '@/lib/actions/auth'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await sendPasswordReset(new FormData(e.currentTarget))
      if (result?.error) {
        setError(result.error)
      } else {
        setSent(true)
      }
    })
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (sent) {
    return (
      <PageShell>
        <div style={{
          borderRadius: 20, border: '1px solid #a7f3d0',
          background: '#ecfdf5', padding: '32px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <h2 style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 700,
            fontSize: 20, color: '#0f172a', margin: '0 0 8px',
          }}>
            Check your inbox!
          </h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
            If <strong>{email}</strong> is linked to a ChoreSync account, you&apos;ll
            receive a reset link within a minute. Check your spam folder if you
            don&apos;t see it.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail('') }}
            style={{
              fontSize: 14, fontWeight: 600, color: '#FF6B2B',
              background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline', padding: 0,
            }}
          >
            Try a different email
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: 20 }}>
          <Link href="/login" style={{ fontWeight: 700, color: '#FF6B2B', textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </p>
      </PageShell>
    )
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 26, color: '#0f172a', margin: '0 0 6px',
        }}>
          Forgot your password?
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          No worries — we&apos;ll send a secure reset link to your inbox.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            borderRadius: 12, border: '1px solid #fecaca',
            background: '#fef2f2', padding: '12px 16px',
            fontSize: 14, color: '#dc2626', marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{
            display: 'block', fontSize: 14, fontWeight: 600,
            color: '#334155', marginBottom: 6,
          }}>
            Email address
          </label>
          <EmailInput value={email} onChange={setEmail} />
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            Enter the email you used to create your account.
          </p>
        </div>

        <SubmitButton loading={isPending} disabled={!email} />
      </form>

      <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: 24 }}>
        Remember your password?{' '}
        <Link href="/login" style={{ fontWeight: 700, color: '#FF6B2B', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </p>
    </PageShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
      `}</style>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FA',
        fontFamily: "'Nunito', sans-serif",
        padding: '40px 24px',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #FF6B2B, #ffb347)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif", fontWeight: 700,
            fontSize: 14, color: '#fff',
          }}>
            CS
          </div>
          <span style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 700,
            fontSize: 20, color: '#0f172a',
          }}>
            ChoreSync
          </span>
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          {children}
        </div>
      </div>
    </>
  )
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="email"
      name="email"
      autoComplete="email"
      required
      placeholder="you@example.com"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', borderRadius: 12, padding: '12px 16px',
        fontSize: 14, color: '#0f172a', background: '#fff',
        border: focused ? '1.5px solid #FF6B2B' : '1.5px solid #e2e8f0',
        boxShadow: focused ? '0 0 0 3px rgba(255,107,43,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
        outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
        boxSizing: 'border-box',
      }}
    />
  )
}

function SubmitButton({ loading, disabled }: { loading: boolean; disabled: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
        gap: 8, borderRadius: 12, padding: '14px 0',
        fontSize: 14, fontWeight: 700, color: '#fff', border: 'none',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        background: loading || disabled ? '#ffb347' : hovered ? '#e55a1f' : '#FF6B2B',
        boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
        opacity: loading || disabled ? 0.65 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        boxSizing: 'border-box',
      }}
    >
      {loading ? <><Spinner /> Sending link…</> : 'Send Reset Link'}
    </button>
  )
}

function Spinner() {
  return (
    <svg
      style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
      fill="none" viewBox="0 0 24 24" aria-hidden
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
