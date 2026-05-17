'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import AuthLayout from '@/components/auth/AuthLayout'
import OAuthButtons from '@/components/ui/OAuthButtons'
import { signUp } from '@/lib/actions/auth'

type Status = 'idle' | 'success' | 'error'

const PASSWORD_MIN = 8

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= PASSWORD_MIN) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  const map = [
    { score: 0, label: '',       color: 'bg-slate-200'   },
    { score: 1, label: 'Weak',   color: 'bg-red-400'     },
    { score: 2, label: 'Fair',   color: 'bg-amber-400'   },
    { score: 3, label: 'Good',   color: 'bg-emerald-400' },
    { score: 4, label: 'Strong', color: 'bg-emerald-500' },
  ]
  return map[score]
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus]         = useState<Status>('idle')
  const [error, setError]           = useState<string | null>(null)
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)

  const strength = getPasswordStrength(password)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const pw       = formData.get('password') as string
    const confirm  = formData.get('confirmPassword') as string

    if (pw !== confirm) { setError('Passwords do not match.'); return }
    if (pw.length < PASSWORD_MIN) { setError(`Password must be at least ${PASSWORD_MIN} characters.`); return }

    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) { setError(result.error); setStatus('error') }
      else { setStatus('success') }
    })
  }

  if (status === 'success') {
    return (
      <AuthLayout title="Check your inbox" subtitle="One last step to get started">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mb-1 font-semibold text-slate-900">Confirmation email sent</h2>
          <p className="text-sm text-slate-500">
            Click the link in your email to activate your account and get started.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already confirmed?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">Sign in</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Set up your household in minutes — it's free">

      {/* Social login */}
      <OAuthButtons />

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-xs font-medium text-slate-400">or sign up with email</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required placeholder="Alex Johnson" className={inputClass} />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={inputClass} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <input
              id="password" name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password" required minLength={PASSWORD_MIN}
              placeholder="Min. 8 characters"
              className={`${inputClass} pr-11`}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-200'}`} />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs text-slate-400">Strength: <span className="font-semibold text-slate-600">{strength.label}</span></p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
          <input
            id="confirmPassword" name="confirmPassword"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password" required
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        <button
          type="submit" disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
        >
          {isPending ? <><Spinner />Creating account…</> : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-400">
          By signing up you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-600">Terms</Link> and{' '}
          <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
        </p>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">Sign in</Link>
      </p>
    </AuthLayout>
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

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
