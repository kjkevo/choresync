'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createHousehold, joinHousehold } from '@/lib/actions/household'

type Step = 'choice' | 'create' | 'create-success' | 'join'

interface CreatedHousehold {
  id:          string
  name:        string
  invite_code: string
}

interface OnboardingClientProps {
  displayName: string
}

export default function OnboardingClient({ displayName }: OnboardingClientProps) {
  const router = useRouter()
  const [step, setStep]                       = useState<Step>('choice')
  const [isPending, startTransition]          = useTransition()
  const [error, setError]                     = useState<string | null>(null)
  const [created, setCreated]                 = useState<CreatedHousehold | null>(null)
  const [copied, setCopied]                   = useState(false)
  const codeInputRef                          = useRef<HTMLInputElement>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createHousehold(fd)
      if (result?.error) {
        setError(result.error)
      } else if (result?.household) {
        setCreated(result.household as CreatedHousehold)
        setStep('create-success')
      }
    })
  }

  function handleJoinSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await joinHousehold(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/dashboard')
      }
    })
  }

  async function copyCode() {
    if (!created) return
    await navigator.clipboard.writeText(created.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Auto-uppercase the join code input ────────────────────────────────────
  function handleCodeInput(e: React.ChangeEvent<HTMLInputElement>) {
    const el  = e.currentTarget
    const pos = el.selectionStart ?? el.value.length
    el.value  = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    el.setSelectionRange(pos, pos)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* Decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-white/8" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-6 text-center text-white">
        <div className="mb-2 text-5xl">🏠</div>
        <h1 className="text-2xl font-extrabold tracking-tight">ChoreSync</h1>
        {step === 'choice' && (
          <p className="mt-2 text-base text-white/80">
            Hey <span className="font-semibold text-white">{displayName}</span>! Let&apos;s get your household set up.
          </p>
        )}
      </div>

      {/* Card */}
      <div className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-12">
        <div className="rounded-3xl bg-white p-8 shadow-2xl">

          {/* ── STEP: choice ─────────────────────────────────────────────── */}
          {step === 'choice' && (
            <div className="animate-fade-in">
              <h2 className="mb-6 text-center text-lg font-bold text-slate-900">
                How would you like to start?
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ChoiceCard
                  emoji="🏗️"
                  title="Create a Household"
                  description="Start fresh and invite your housemates"
                  onClick={() => { setError(null); setStep('create') }}
                />
                <ChoiceCard
                  emoji="🔑"
                  title="Join a Household"
                  description="Enter a 6-character code from a housemate"
                  onClick={() => { setError(null); setStep('join') }}
                />
              </div>

              <p className="mt-6 text-center text-xs text-slate-400">
                You can always change your household later from settings.
              </p>
            </div>
          )}

          {/* ── STEP: create ─────────────────────────────────────────────── */}
          {step === 'create' && (
            <div className="animate-fade-in">
              <button
                type="button"
                onClick={() => { setError(null); setStep('choice') }}
                className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronLeftIcon /> Back
              </button>

              <div className="mb-6 text-center">
                <div className="mb-2 text-4xl">🏡</div>
                <h2 className="text-lg font-bold text-slate-900">Name your household</h2>
                <p className="mt-1 text-sm text-slate-500">
                  This is how your housemates will identify your home.
                </p>
              </div>

              {error && <div className="alert-error mb-4" role="alert">{error}</div>}

              <form onSubmit={handleCreateSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="label">Household name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder='e.g. "The Johnson House" or "Apt 4B"'
                    className="input text-center text-base font-semibold"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full">
                  {isPending ? <><Spinner /> Creating…</> : 'Create Household →'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP: create-success ─────────────────────────────────────── */}
          {step === 'create-success' && created && (
            <div className="animate-fade-in text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
                  🎉
                </div>
              </div>
              <h2 className="mb-1 text-xl font-bold text-slate-900">
                {created.name}
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Your household is ready. Share the code below to invite housemates.
              </p>

              {/* Invite code display */}
              <div className="mb-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-6 py-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  Invite Code
                </p>
                <p className="font-mono text-4xl font-black tracking-[0.35em] text-indigo-600">
                  {created.invite_code}
                </p>
              </div>

              <p className="mb-5 text-xs text-slate-400">
                Your housemates enter this code on their "Join" screen.
                You can always find it again in household settings.
              </p>

              {/* Action buttons */}
              <div className="mb-6 flex gap-3">
                <button
                  type="button"
                  onClick={copyCode}
                  className={`btn-ghost flex-1 ${copied ? 'border-emerald-300 text-emerald-600' : ''}`}
                >
                  {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy code</>}
                </button>

                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={() =>
                      navigator.share({
                        title: `Join ${created.name} on ChoreSync`,
                        text:  `Use invite code ${created.invite_code} to join our household!`,
                      })
                    }
                    className="btn-ghost flex-1"
                  >
                    <ShareIcon /> Share
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="btn-primary w-full"
              >
                Go to Dashboard →
              </button>
            </div>
          )}

          {/* ── STEP: join ───────────────────────────────────────────────── */}
          {step === 'join' && (
            <div className="animate-fade-in">
              <button
                type="button"
                onClick={() => { setError(null); setStep('choice') }}
                className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronLeftIcon /> Back
              </button>

              <div className="mb-6 text-center">
                <div className="mb-2 text-4xl">🔑</div>
                <h2 className="text-lg font-bold text-slate-900">Join a household</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ask your housemate for their 6-character invite code.
                </p>
              </div>

              {error && <div className="alert-error mb-4" role="alert">{error}</div>}

              <form onSubmit={handleJoinSubmit} className="space-y-5">
                <div>
                  <label htmlFor="code" className="label">Invite code</label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    ref={codeInputRef}
                    required
                    minLength={6}
                    maxLength={6}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={handleCodeInput}
                    className="input text-center font-mono text-2xl font-bold uppercase tracking-[0.5em]"
                    autoFocus
                  />
                  <p className="mt-1.5 text-center text-xs text-slate-400">
                    Letters and numbers only — not case-sensitive.
                  </p>
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full">
                  {isPending ? <><Spinner /> Joining…</> : 'Join Household →'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChoiceCard({
  emoji,
  title,
  description,
  onClick,
}: {
  emoji: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left
                 transition hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md
                 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <div className="mb-3 text-3xl">{emoji}</div>
      <p className="mb-1 font-bold text-slate-900 group-hover:text-indigo-700">{title}</p>
      <p className="text-xs leading-relaxed text-slate-500">{description}</p>
    </button>
  )
}

// ── Tiny icon components ───────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
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
