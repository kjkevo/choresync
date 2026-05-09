'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import AuthLayout from '@/components/auth/AuthLayout'
import { sendPasswordReset } from '@/lib/actions/auth'

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await sendPasswordReset(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSent(true)
      }
    })
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="We sent you a reset link">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center">
          <div className="mb-3 text-5xl">📧</div>
          <h2 className="mb-2 font-semibold text-slate-900">Email sent!</h2>
          <p className="text-sm text-slate-600">
            If <strong>{email}</strong> is linked to an account, you&apos;ll receive a
            password-reset link within a minute. Check your spam folder if you don&apos;t
            see it.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => { setSent(false); setEmail('') }}
            className="btn-ghost w-full"
          >
            Try a different email
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
              ← Back to Sign In
            </Link>
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="No worries — we'll send you a reset link"
    >
      {error && (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Enter the email you used to sign up. We&apos;ll send a secure reset link.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || !email}
          className="btn-primary w-full"
        >
          {isPending ? (
            <>
              <Spinner />
              Sending link…
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remember your password?{' '}
        <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Back to Sign In
        </Link>
      </p>
    </AuthLayout>
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
