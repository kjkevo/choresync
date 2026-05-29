'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { logIn, signUp } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'login' | 'signup'

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pw: string) {
  let s = 0
  if (pw.length >= 8)           s++
  if (/[A-Z]/.test(pw))         s++
  if (/[0-9]/.test(pw))         s++
  if (/[^A-Za-z0-9]/.test(pw))  s++
  const map = [
    { label: '',       color: '#e2e8f0' },
    { label: 'Weak',   color: '#f87171' },
    { label: 'Fair',   color: '#fbbf24' },
    { label: 'Good',   color: '#34d399' },
    { label: 'Strong', color: '#10b981' },
  ]
  return { score: s, ...map[s] }
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AuthScreen({
  initialTab,
  redirectTo,
}: {
  initialTab: 'login' | 'signup'
  redirectTo: string
}) {
  const [tab, setTab] = useState<Tab>(initialTab)

  // Fix #9 — update browser tab title when user toggles between sign in / sign up
  useEffect(() => {
    document.title = tab === 'login' ? 'Sign In | ChoreSync' : 'Sign Up | ChoreSync'
  }, [tab])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700&display=swap');

        .cs-left-panel {
          display: flex;
          width: 42%;
          flex-direction: column;
          justify-content: space-between;
          padding: 56px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, #FF6B2B 0%, #ff8f5e 50%, #ffb347 100%);
        }

        @media (max-width: 1023px) {
          .cs-left-panel {
            display: none;
          }
        }

        .cs-spinner {
          animation: cs-spin 1s linear infinite;
        }

        @keyframes cs-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: "'Nunito', sans-serif",
      }}>

        {/* ── Left brand panel ──────────────────────────────────────────────── */}
        <div className="cs-left-panel">
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -80, right: -80,
            width: 320, height: 320, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
          }} />
          <div style={{
            position: 'absolute', bottom: -64, left: -64,
            width: 256, height: 256, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', right: 32,
            width: 128, height: 128, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 16,
                background: 'rgba(255,255,255,0.25)', color: '#fff',
              }}>
                CS
              </div>
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                fontSize: 22, color: '#fff',
              }}>
                ChoreSync
              </span>
            </div>
          </div>

          {/* Center copy */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 800,
                fontSize: 36, color: '#fff', lineHeight: 1.2,
                marginBottom: 16, margin: 0,
              }}>
                Your household,<br />perfectly in sync.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
                Assign chores, track progress, and celebrate wins — together.
              </p>
            </div>

            {/* Feature list — only features that actually ship */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0 0' }}>
              {[
                'Smart scheduling based on your habits',
                'Google & Apple Calendar sync',
                'Offline mode — works without internet',
                'Shared household supply list',
              ].map((text) => (
                <li key={text} style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: 'rgba(255,255,255,0.25)', color: '#fff',
                  }}>
                    ✓
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 500 }}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p style={{
            position: 'relative', zIndex: 10,
            color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0,
          }}>
            © {new Date().getFullYear()} ChoreSync
          </p>
        </div>

        {/* ── Right form panel ──────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#fff', padding: '48px 24px', overflowY: 'auto',
        }}>

          {/* Mobile logo — only visible when left panel is hidden */}
          <div className="cs-mobile-logo" style={{
            marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <style>{`
              .cs-mobile-logo { display: none; }
              @media (max-width: 1023px) { .cs-mobile-logo { display: flex; } }
            `}</style>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #FF6B2B, #ffb347)',
              fontFamily: "'Poppins', sans-serif",
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

          <div style={{ width: '100%', maxWidth: 380 }}>

            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                fontSize: 28, color: '#0f172a', margin: 0,
              }}>
                {tab === 'login' ? 'Welcome back 👋' : 'Create your account'}
              </h1>
              <p style={{ marginTop: 6, fontSize: 14, color: '#64748b' }}>
                {tab === 'login'
                  ? 'Sign in to manage your household chores'
                  : "Set up your household in minutes — it's free"}
              </p>
            </div>

            {/* Tab toggle */}
            <div style={{
              display: 'flex', borderRadius: 12,
              padding: 4, marginBottom: 28,
              background: '#f1f5f9',
            }}>
              {(['login', 'signup'] as Tab[]).map(t => (
                <TabButton
                  key={t}
                  active={tab === t}
                  label={t === 'login' ? 'Sign In' : 'Sign Up'}
                  onClick={() => setTab(t)}
                />
              ))}
            </div>

            {/* Forms */}
            {tab === 'login'
              ? <LoginForm redirectTo={redirectTo} />
              : <SignupForm onSuccess={() => setTab('login')} />
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
        borderRadius: 10, border: 'none', cursor: 'pointer',
        transition: 'all 0.18s ease',
        background: active ? '#FF6B2B' : 'transparent',
        color: active ? '#fff' : '#64748b',
        boxShadow: active ? '0 2px 8px rgba(255,107,43,0.35)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [showPw, setShowPw]          = useState(false)
  const [rememberMe, setRememberMe]  = useState(true)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await logIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SocialButtons redirectTo={redirectTo} />
      <Divider label="or continue with email" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <Field label="Email address">
          <StyledInput name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>

        <Field
          label="Password"
          action={
            <Link href="/forgot-password" style={{
              fontSize: 12, fontWeight: 600, color: '#FF6B2B',
              textDecoration: 'none',
            }}>
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            name="password"
            autoComplete="current-password"
            show={showPw}
            onToggle={() => setShowPw(v => !v)}
          />
        </Field>

        {/* Remember Me */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            name="rememberMe"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            style={{
              width: 16, height: 16, accentColor: '#FF6B2B', cursor: 'pointer',
              borderRadius: 4, flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>
            Remember me on this device
          </span>
        </label>

        <SubmitButton loading={isPending} label="Sign In" loadingLabel="Signing in…" />
      </form>

      <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', margin: 0 }}>
        Don&apos;t have an account?{' '}
        <Link href="/login?tab=signup" style={{ fontWeight: 600, color: '#FF6B2B', textDecoration: 'none' }}>
          Sign up free
        </Link>
      </p>
    </div>
  )
}

// ─── Signup form ──────────────────────────────────────────────────────────────
function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [password, setPassword]      = useState('')
  const [showPw, setShowPw]          = useState(false)
  const [done, setDone]              = useState(false)

  const strength = getStrength(password)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const pw       = formData.get('password') as string
    const confirm  = formData.get('confirmPassword') as string

    if (pw !== confirm) { setError('Passwords do not match.'); return }
    if (pw.length < 8)  { setError('Password must be at least 8 characters.'); return }

    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) setError(result.error)
      else setDone(true)
    })
  }

  if (done) {
    return (
      <div style={{
        borderRadius: 16, border: '1px solid #a7f3d0',
        background: '#ecfdf5', padding: '24px', textAlign: 'center',
      }}>
        <div style={{
          marginBottom: 12, marginLeft: 'auto', marginRight: 'auto',
          width: 48, height: 48, borderRadius: '50%',
          background: '#d1fae5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg style={{ width: 24, height: 24, color: '#059669' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>Check your inbox!</h3>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px 0' }}>
          Click the confirmation link we emailed you to activate your account.
        </p>
        <button
          onClick={onSuccess}
          style={{
            fontSize: 14, fontWeight: 600, color: '#FF6B2B',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Back to sign in →
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SocialButtons />
      <Divider label="or sign up with email" />
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* First name + Last name grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="First name">
            <StyledInput name="firstName" type="text" autoComplete="given-name" placeholder="Alex" />
          </Field>
          <Field
            label="Last name"
            action={
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>optional</span>
            }
          >
            <StyledInput name="lastName" type="text" autoComplete="family-name" placeholder="Johnson" required={false} />
          </Field>
        </div>

        <Field label="Email address">
          <StyledInput name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>

        <Field label="Password">
          <PasswordInput
            name="password"
            autoComplete="new-password"
            show={showPw}
            onToggle={() => setShowPw(v => !v)}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          {/* Always-visible requirements */}
          {password.length === 0 && (
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              At least 8 characters · mix of letters &amp; numbers recommended
            </p>
          )}
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    height: 4, flex: 1, borderRadius: 9999,
                    background: i <= strength.score ? strength.color : '#e2e8f0',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              {strength.label && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Strength: <span style={{ fontWeight: 600, color: '#475569' }}>{strength.label}</span>
                </p>
              )}
            </div>
          )}
        </Field>

        <Field label="Confirm password">
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            show={showPw}
            onToggle={() => setShowPw(v => !v)}
            placeholder="Repeat your password"
          />
        </Field>

        <SubmitButton loading={isPending} label="Create Account" loadingLabel="Creating account…" />

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', margin: 0 }}>
          By signing up you agree to our{' '}
          <Link href="/terms" style={{ textDecoration: 'underline', color: 'inherit' }}>Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{ textDecoration: 'underline', color: 'inherit' }}>Privacy Policy</Link>.
        </p>
      </form>
    </div>
  )
}

// ─── Social buttons ───────────────────────────────────────────────────────────
function SocialButtons({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function signInWith(provider: 'google' | 'apple') {
    setLoading(provider)
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        scopes: provider === 'google' ? 'profile email' : 'name email',
      },
    })
    if (oauthError) { setError(oauthError.message); setLoading(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <ErrorBanner message={error} />}

      {/* Google — full width; Apple requires native iOS config, so omitted on web */}
      <SocialButton
        label="Continue with Google"
        disabled={loading !== null}
        loading={loading === 'google'}
        onClick={() => signInWith('google')}
        icon={<GoogleIcon />}
      />
    </div>
  )
}

function SocialButton({
  label, disabled, loading, onClick, icon,
}: {
  label: string; disabled: boolean; loading: boolean;
  onClick: () => void; icon: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, borderRadius: 12, border: hovered ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
        background: '#fff', padding: '12px 0', fontSize: 14, fontWeight: 600,
        color: '#334155', cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s ease',
      }}
    >
      {loading ? <Spinner /> : icon}
      {label}
    </button>
  )
}

// ─── Small reusable components ────────────────────────────────────────────────

function Field({
  label, children, action,
}: {
  label: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{label}</label>
        {action}
      </div>
      {children}
    </div>
  )
}

function StyledInput({
  name, type, autoComplete, placeholder, required = true,
}: {
  name: string; type: string; autoComplete?: string; placeholder?: string; required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      name={name}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      required={required}
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

function PasswordInput({
  name, autoComplete, show, onToggle, value, onChange, placeholder = '••••••••',
}: {
  name: string; autoComplete?: string; show: boolean; onToggle: () => void;
  value?: string; onChange?: (v: string) => void; placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        name={name}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', borderRadius: 12, padding: '12px 44px 12px 16px',
          fontSize: 14, color: '#0f172a', background: '#fff',
          border: focused ? '1.5px solid #FF6B2B' : '1.5px solid #e2e8f0',
          boxShadow: focused ? '0 0 0 3px rgba(255,107,43,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
          outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0,
        }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function SubmitButton({
  loading, label, loadingLabel,
}: {
  loading: boolean; label: string; loadingLabel: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
        gap: 8, borderRadius: 12, padding: '14px 0',
        fontSize: 14, fontWeight: 700, color: '#fff', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? '#ffb347' : hovered ? '#e55a1f' : '#FF6B2B',
        boxShadow: '0 4px 14px rgba(255,107,43,0.4)',
        opacity: loading ? 0.7 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        boxSizing: 'border-box',
      }}
    >
      {loading ? <><Spinner />{loadingLabel}</> : label}
    </button>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ height: 1, flex: 1, background: '#f1f5f9' }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: '#f1f5f9' }} />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        borderRadius: 12, border: '1px solid #fecaca',
        background: '#fef2f2', padding: '12px 16px',
        fontSize: 14, color: '#dc2626',
      }}
    >
      {message}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="cs-spinner"
      style={{ width: 16, height: 16 }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg style={{ width: 16, height: 16, flexShrink: 0 }} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

