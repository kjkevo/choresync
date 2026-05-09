'use client'

import { useState, useTransition } from 'react'
import AuthLayout from '@/components/auth/AuthLayout'
import { updatePassword } from '@/lib/actions/auth'

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

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [password, setPassword]      = useState('')
  const [confirm, setConfirm]        = useState('')
  const [showPw, setShowPw]          = useState(false)

  const strength = getPasswordStrength(password)
  const mismatch = confirm.length > 0 && confirm !== password

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`)
      return
    }

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updatePassword(formData)
      // updatePassword redirects on success; only hits here on error
      if (result?.error) setError(result.error)
    })
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose something strong and memorable"
    >
      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* New password */}
        <div>
          <label htmlFor="password" className="label">New password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN}
              placeholder="Min. 8 characters"
              className="input pr-12"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Strength indicator */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= strength.score ? strength.color : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs text-slate-500">
                  Strength:{' '}
                  <span className="font-semibold text-slate-700">{strength.label}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirm" className="label">Confirm new password</label>
          <input
            id="confirm"
            name="confirmPassword"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            className={`input ${mismatch ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
          {mismatch && (
            <p className="mt-1 text-xs text-red-500">Passwords don&apos;t match.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || mismatch || password.length < PASSWORD_MIN}
          className="btn-primary w-full"
        >
          {isPending ? (
            <>
              <Spinner />
              Updating…
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </form>
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
