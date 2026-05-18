'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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

// ─── Root export (Suspense wrapper for useSearchParams) ───────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const searchParams = useSearchParams()
  const initialTab   = (searchParams.get('tab') as Tab) ?? 'login'
  const redirectTo   = searchParams.get('redirectTo') ?? '/dashboard'

  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div style={{ fontFamily: 'var(--font-nunito), sans-serif' }} className="flex min-h-screen">

      {/* ── Left brand panel ──────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #FF6B2B 0%, #ff8f5e 50%, #ffb347 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-15"
          style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="absolute top-1/2 right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'rgba(255,255,255,0.5)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg"
              style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontFamily: 'var(--font-poppins)' }}>
              CS
            </div>
            <span className="text-2xl font-bold text-white"
              style={{ fontFamily: 'var(--font-poppins)' }}>
              ChoreSync
            </span>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4"
              style={{ fontFamily: 'var(--font-poppins)' }}>
              Your household,<br />perfectly in sync.
            </h2>
            <p className="text-white/80 text-base leading-relaxed">
              Assign chores, track progress, and celebrate wins — together.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-4">
            {[
              { icon: '✓', text: 'Smart chore rotation & assignment' },
              { icon: '✓', text: 'Points, streaks & badge rewards' },
              { icon: '✓', text: 'Photo proof of completion' },
              { icon: '✓', text: 'Real-time household chat' },
            ].map(f => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                  {f.icon}
                </span>
                <span className="text-white/90 text-sm font-medium">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/50 text-xs">
          © {new Date().getFullYear()} ChoreSync
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 overflow-y-auto">

        {/* Mobile logo */}
        <div className="mb-8 lg:hidden flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--brand)', fontFamily: 'var(--font-poppins)' }}>
            CS
          </div>
          <span className="text-xl font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-poppins)' }}>
            ChoreSync
          </span>
        </div>

        <div className="w-full max-w-[400px]">

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-poppins)' }}>
              {tab === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {tab === 'login'
                ? 'Sign in to manage your household chores'
                : 'Set up your household in minutes — it\'s free'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-xl p-1 mb-7" style={{ background: '#f1f5f9' }}>
            {(['login', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200"
                style={
                  tab === t
                    ? { background: 'var(--brand)', color: '#fff', boxShadow: '0 2px 8px rgba(255,107,43,0.35)' }
                    : { background: 'transparent', color: '#64748b' }
                }
              >
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
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
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [showPw, setShowPw]          = useState(false)

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
    <div className="space-y-5">
      <SocialButtons redirectTo={redirectTo} />

      <Divider label="or continue with email" />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <Field label="Email address">
          <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>

        <Field label="Password" action={
          <Link href="/forgot-password" className="text-xs font-semibold transition hover:opacity-80" style={{ color: 'var(--brand)' }}>
            Forgot password?
          </Link>
        }>
          <PasswordInput name="password" autoComplete="current-password" show={showPw} onToggle={() => setShowPw(v => !v)} />
        </Field>

        <SubmitButton loading={isPending} label="Sign In" loadingLabel="Signing in…" />
      </form>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold transition hover:opacity-80" style={{ color: 'var(--brand)' }}>
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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">Check your inbox!</h3>
        <p className="text-sm text-slate-500 mb-4">Click the confirmation link we emailed you to activate your account.</p>
        <button onClick={onSuccess} className="text-sm font-semibold transition hover:opacity-80" style={{ color: 'var(--brand)' }}>
          Back to sign in →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SocialButtons />

      <Divider label="or sign up with email" />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Full name">
          <Input name="fullName" type="text" autoComplete="name" placeholder="Alex Johnson" />
        </Field>

        <Field label="Email address">
          <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>

        <Field label="Password">
          <PasswordInput
            name="password" autoComplete="new-password"
            show={showPw} onToggle={() => setShowPw(v => !v)}
            value={password} onChange={setPassword}
            placeholder="Min. 8 characters"
          />
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all"
                    style={{ background: i <= strength.score ? strength.color : '#e2e8f0' }} />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs text-slate-400">Strength: <span className="font-semibold text-slate-600">{strength.label}</span></p>
              )}
            </div>
          )}
        </Field>

        <Field label="Confirm password">
          <PasswordInput name="confirmPassword" autoComplete="new-password" show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Repeat your password" />
        </Field>

        <SubmitButton loading={isPending} label="Create Account" loadingLabel="Creating account…" />

        <p className="text-center text-xs text-slate-400">
          By signing up you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-600">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        scopes: provider === 'google' ? 'profile email' : 'name email',
      },
    })
    if (error) { setError(error.message); setLoading(null) }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} />}

      <div className="flex gap-3">
        {/* Google */}
        <button
          type="button" onClick={() => signInWith('google')} disabled={loading !== null}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {loading === 'google' ? <Spinner /> : <GoogleIcon />}
          Google
        </button>

        {/* Apple */}
        <button
          type="button" onClick={() => signInWith('apple')} disabled={loading !== null}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {loading === 'apple' ? <Spinner /> : <AppleIcon />}
          Apple
        </button>
      </div>
    </div>
  )
}

// ─── Small reusable components ────────────────────────────────────────────────

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        {action}
      </div>
      {children}
    </div>
  )
}

function Input({ name, type, autoComplete, placeholder }: {
  name: string; type: string; autoComplete?: string; placeholder?: string
}) {
  return (
    <input
      name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} required
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-transparent focus:ring-2"
      style={{ ['--tw-ring-color' as string]: 'var(--brand)' } as React.CSSProperties}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.15)' }}
      onBlur={e  => { e.currentTarget.style.borderColor = '#cbd5e1';      e.currentTarget.style.boxShadow = '' }}
    />
  )
}

function PasswordInput({ name, autoComplete, show, onToggle, value, onChange, placeholder = '••••••••' }: {
  name: string; autoComplete?: string; show: boolean; onToggle: () => void;
  value?: string; onChange?: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <input
        name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete}
        placeholder={placeholder} required
        value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition"
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.15)' }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#cbd5e1';      e.currentTarget.style.boxShadow = '' }}
      />
      <button type="button" onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit" disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
      style={{ background: loading ? 'var(--brand-light)' : 'var(--brand)', boxShadow: '0 4px 14px rgba(255,107,43,0.4)' }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-dark)' }}
      onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand)' }}
    >
      {loading ? <><Spinner />{loadingLabel}</> : label}
    </button>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-100" />
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
      {message}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}
