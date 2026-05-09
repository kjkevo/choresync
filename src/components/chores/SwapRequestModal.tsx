'use client'

import { useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { sendSwapRequest } from '@/lib/actions/rotation'
import type { ChoreWithAssignee, UserRow } from '@/lib/types/database'

interface Member {
  id:        string
  name:      string | null
  avatarUrl: string | null
  color:     string
}

interface SwapRequestModalProps {
  chore:    ChoreWithAssignee
  /** Eligible swap candidates (rotation members, or all household members, excluding self) */
  members:  Member[]
  onClose:  () => void
  onSent:   () => void
}

export default function SwapRequestModal({ chore, members, onClose, onSent }: SwapRequestModalProps) {
  const [selected, setSelected]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSend() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await sendSwapRequest(chore.id, selected)
      if (result?.error) { setError(result.error); return }
      onSent()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl sm:my-6 animate-slide-up">
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        {/* Header */}
        <div className="px-6 pb-2 pt-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Request a swap
              </p>
              <h2 className="mt-0.5 font-bold text-slate-900">{chore.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Ask another member to take this chore. They can accept or decline.
          </p>
        </div>

        {/* Member list */}
        <div className="mt-1 space-y-2 px-6 pb-4">
          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No other members to swap with.
            </p>
          ) : (
            members.map(m => {
              const active = selected === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition
                    ${active
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    }`}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.avatarUrl ? (
                      <Image src={m.avatarUrl} alt={m.name ?? ''} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      initials(m.name)
                    )}
                  </div>
                  <span className="flex-1 font-semibold text-slate-900">
                    {m.name ?? 'Unknown'}
                  </span>
                  {active && (
                    <span className="text-indigo-600">
                      <CheckCircleIcon className="h-5 w-5" />
                    </span>
                  )}
                </button>
              )
            })
          )}

          {error && (
            <div className="alert-error mt-2" role="alert">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {isPending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Also used by ManualOverrideModal ─────────────────────────────────────────

interface ManualOverrideModalProps {
  chore:    ChoreWithAssignee
  members:  Member[]
  onClose:  () => void
  onDone:   (newUserId: string) => void
}

export function ManualOverrideModal({ chore, members, onClose, onDone }: ManualOverrideModalProps) {
  const [selected, setSelected] = useState<string | null>(chore.assigned_to)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl sm:my-6 animate-slide-up">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="px-6 pb-2 pt-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Manual override
              </p>
              <h2 className="mt-0.5 font-bold text-slate-900">{chore.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Reassign this chore to any rotation member. The rotation order will update accordingly.
          </p>
        </div>

        <div className="mt-1 space-y-2 px-6 pb-4">
          {members.map(m => {
            const active = selected === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition
                  ${active ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                  style={{ background: m.color }}
                >
                  {m.avatarUrl ? (
                    <Image src={m.avatarUrl} alt={m.name ?? ''} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    initials(m.name)
                  )}
                </div>
                <span className="flex-1 font-semibold text-slate-900">{m.name ?? 'Unknown'}</span>
                {active && <span className="text-amber-600"><CheckCircleIcon className="h-5 w-5" /></span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            type="button"
            onClick={() => selected && onDone(selected)}
            disabled={!selected}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
