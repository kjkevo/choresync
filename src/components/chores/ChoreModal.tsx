'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { createChore, updateChore } from '@/lib/actions/chores'
import type {
  ChoreRow,
  ChoreCategory,
  ChoreFrequency,
  ChorePriority,
  UserRow,
} from '@/lib/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<ChoreCategory, { label: string; emoji: string }> = {
  kitchen:  { label: 'Kitchen',  emoji: '🍳' },
  bathroom: { label: 'Bathroom', emoji: '🚿' },
  bedroom:  { label: 'Bedroom',  emoji: '🛏️' },
  outdoor:  { label: 'Outdoor',  emoji: '🌿' },
  laundry:  { label: 'Laundry',  emoji: '👕' },
  general:  { label: 'General',  emoji: '🏠' },
}

export const PRIORITY_META: Record<ChorePriority, { label: string; color: string; ring: string }> = {
  low:    { label: 'Low',    color: 'bg-emerald-500', ring: 'ring-emerald-500' },
  medium: { label: 'Medium', color: 'bg-amber-400',   ring: 'ring-amber-400'   },
  high:   { label: 'High',   color: 'bg-red-500',     ring: 'ring-red-500'     },
}

export const FREQUENCY_OPTIONS: { value: ChoreFrequency; label: string }[] = [
  { value: 'one-time',  label: 'One-time'      },
  { value: 'daily',     label: 'Daily'         },
  { value: 'weekly',    label: 'Weekly'        },
  { value: 'biweekly',  label: 'Every 2 weeks' },
  { value: 'monthly',   label: 'Monthly'       },
]

const DEFAULT_PRIORITY_POINTS: Record<ChorePriority, number> = { low: 5, medium: 10, high: 20 }

function todayIso() { return new Date().toISOString().split('T')[0] }

// ── Component ─────────────────────────────────────────────────────────────────

interface ChoreModalProps {
  householdId:    string
  chore?:         ChoreRow
  members:        (UserRow & { color_theme?: string })[]
  onClose:        () => void
  onSaved?:       (chore: ChoreRow) => void
  /** Household-level default point values from settings (optional) */
  pointDefaults?: { low?: number; medium?: number; high?: number }
  /** Custom category slugs added by the admin (optional) */
  customCategories?: string[]
}

export default function ChoreModal({
  householdId, chore, members, onClose, onSaved,
  pointDefaults, customCategories = [],
}: ChoreModalProps) {
  const isEdit = !!chore

  // Merge household defaults with built-in defaults
  const PRIORITY_POINTS: Record<ChorePriority, number> = {
    low:    pointDefaults?.low    ?? DEFAULT_PRIORITY_POINTS.low,
    medium: pointDefaults?.medium ?? DEFAULT_PRIORITY_POINTS.medium,
    high:   pointDefaults?.high   ?? DEFAULT_PRIORITY_POINTS.high,
  }

  // Controlled pickers
  const [category,  setCategory]  = useState<ChoreCategory>(chore?.category  ?? 'general')
  const [priority,  setPriority]  = useState<ChorePriority>(chore?.priority  ?? 'medium')
  const [frequency, setFrequency] = useState<ChoreFrequency>(chore?.frequency ?? 'one-time')

  // Points — auto-suggests from priority, but lets admin override
  const [points, setPoints]           = useState<number>(chore?.points ?? PRIORITY_POINTS[chore?.priority ?? 'medium'])
  const [pointsEdited, setPointsEdited] = useState(!!chore?.points)
  useEffect(() => {
    if (!pointsEdited) setPoints(PRIORITY_POINTS[priority])
  }, [priority]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rotation
  const existingMembers = Array.isArray(chore?.rotation_members)
    ? (chore.rotation_members as unknown as string[])
    : []
  const [rotationEnabled, setRotationEnabled] = useState(chore?.rotation_enabled ?? false)
  const [rotationMembers, setRotationMembers] = useState<string[]>(existingMembers)

  // Form state
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const formRef                      = useRef<HTMLFormElement>(null)
  const firstInputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Rotation member helpers
  function toggleMember(userId: string) {
    setRotationMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }
  function moveMember(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= rotationMembers.length) return
    setRotationMembers(prev => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Validate rotation needs recurring frequency
    if (rotationEnabled && frequency === 'one-time') {
      setError('Rotation requires a recurring frequency (daily, weekly, etc.).')
      return
    }
    if (rotationEnabled && rotationMembers.length < 2) {
      setError('Please select at least 2 members for the rotation.')
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('category',         category)
    fd.set('priority',         priority)
    fd.set('frequency',        frequency)
    fd.set('points',           String(points))
    fd.set('rotation_enabled', String(rotationEnabled))
    fd.set('rotation_members', JSON.stringify(rotationMembers))

    startTransition(async () => {
      const result = isEdit
        ? await updateChore(chore!.id, fd)
        : await createChore(fd)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = result as any
      if (res?.error) {
        setError(res.error as string)
      } else {
        onSaved?.(res?.chore as ChoreRow)
        onClose()
      }
    })
  }

  const recurringFrequency = frequency !== 'one-time'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl sm:my-6 animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900">
            {isEdit ? 'Edit Chore' : 'New Chore'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <form ref={formRef} id="chore-form" onSubmit={handleSubmit} noValidate>
            <input type="hidden" name="household_id" value={householdId} />

            <div className="space-y-6 px-6 py-5">
              {error && <div className="alert-error" role="alert">{error}</div>}

              {/* Name */}
              <div>
                <label htmlFor="name" className="label">
                  Chore name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="name" name="name" type="text"
                  required maxLength={120}
                  defaultValue={chore?.name}
                  placeholder='e.g. "Mop kitchen floor"'
                  className="input"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="label">
                  Instructions <span className="text-slate-300">(optional)</span>
                </label>
                <textarea
                  id="description" name="description"
                  rows={3} maxLength={500}
                  defaultValue={chore?.description ?? ''}
                  placeholder='e.g. "Use the mop from the laundry room."'
                  className="input resize-none"
                />
              </div>

              {/* Category picker */}
              <div>
                <p className="label">Category</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_META) as ChoreCategory[]).map(cat => {
                    const { label, emoji } = CATEGORY_META[cat]
                    const active = category === (cat as string)
                    return (
                      <button
                        key={cat} type="button" onClick={() => setCategory(cat)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-semibold transition
                          ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}
                      >
                        <span className="text-xl leading-none">{emoji}</span>
                        {label}
                      </button>
                    )
                  })}
                  {customCategories.map(cat => {
                    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    const active = category === (cat as ChoreCategory)
                    return (
                      <button
                        key={cat} type="button" onClick={() => setCategory(cat as ChoreCategory)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-semibold transition
                          ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'}`}
                      >
                        <span className="text-xl leading-none">🏷️</span>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="label">Priority</p>
                <div className="flex gap-2">
                  {(Object.keys(PRIORITY_META) as ChorePriority[]).map(p => {
                    const { label, color, ring } = PRIORITY_META[p]
                    const active = priority === p
                    return (
                      <button
                        key={p} type="button" onClick={() => setPriority(p)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition
                          ${active ? `border-current text-slate-900 ring-2 ring-offset-1 ${ring} bg-white` : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Frequency + Estimated time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="frequency" className="label">Frequency</label>
                  <select
                    id="frequency" name="frequency"
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as ChoreFrequency)}
                    className="input"
                  >
                    {FREQUENCY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="estimated_mins" className="label">
                    Est. time <span className="text-slate-300 normal-case font-normal">(mins)</span>
                  </label>
                  <input
                    id="estimated_mins" name="estimated_mins"
                    type="number" min={1} max={480} step={5}
                    defaultValue={chore?.estimated_mins ?? ''}
                    placeholder="30"
                    className="input"
                  />
                </div>
              </div>

              {/* Points */}
              <div>
                <label htmlFor="points" className="label">
                  Points reward
                  <span className="ml-1 text-xs font-normal text-slate-400">(0 = no points, max 100)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="points" name="points"
                    type="number" min={0} max={100} step={5}
                    value={points}
                    onChange={e => { setPoints(parseInt(e.target.value, 10) || 0); setPointsEdited(true) }}
                    className="input w-28"
                  />
                  <div className="flex gap-1">
                    {([['low', 5], ['medium', 10], ['high', 20]] as const).map(([p, pts]) => (
                      <button
                        key={p} type="button"
                        onClick={() => { setPoints(pts); setPointsEdited(false) }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                          points === pts && priority === p
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                        title={`${p} suggestion`}
                      >
                        🏆 {pts}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Assigned to + Due date (non-rotation only shows assignee picker) */}
              <div className="grid grid-cols-2 gap-4">
                {!rotationEnabled && (
                  <div>
                    <label htmlFor="assigned_to" className="label">Assigned to</label>
                    <select id="assigned_to" name="assigned_to" defaultValue={chore?.assigned_to ?? ''} className="input">
                      <option value="">Unassigned</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name ?? m.email?.split('@')[0] ?? 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={rotationEnabled ? 'col-span-2' : ''}>
                  <label htmlFor="due_date" className="label">Due date</label>
                  <input
                    id="due_date" name="due_date" type="date"
                    defaultValue={chore?.due_date ?? ''}
                    min={isEdit ? undefined : todayIso()}
                    className="input"
                  />
                </div>
              </div>

              {/* ── Rotation ─────────────────────────────────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50">
                {/* Toggle header */}
                <button
                  type="button"
                  onClick={() => {
                    if (!recurringFrequency && !rotationEnabled) {
                      setError('Switch to a recurring frequency (weekly, monthly, etc.) before enabling rotation.')
                      return
                    }
                    setError(null)
                    setRotationEnabled(v => !v)
                  }}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">🔄</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900">Enable Rotation</p>
                      <p className="text-xs text-slate-400">Automatically cycles assignee each completion</p>
                    </div>
                  </div>
                  {/* Toggle pill */}
                  <div className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${rotationEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${rotationEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                {rotationEnabled && (
                  <div className="border-t border-slate-200 px-4 pb-4 pt-3 space-y-4">
                    {!recurringFrequency && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        ⚠️ Change frequency to Weekly, Monthly, etc. for rotation to work.
                      </p>
                    )}

                    {/* Member checkboxes */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Select members to rotate
                      </p>
                      <div className="space-y-1.5">
                        {members.map(m => {
                          const checked = rotationMembers.includes(m.id)
                          return (
                            <label
                              key={m.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition
                                ${checked ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMember(m.id)}
                                className="h-4 w-4 rounded accent-indigo-600"
                              />
                              <div
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: m.color_theme ?? '#6366f1' }}
                              >
                                {(m.full_name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="flex-1 text-sm font-semibold text-slate-900">
                                {m.full_name ?? m.email?.split('@')[0] ?? 'Unknown'}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* Rotation order (selected members only) */}
                    {rotationMembers.length >= 2 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Rotation order — drag to reorder
                        </p>
                        <div className="space-y-1.5">
                          {rotationMembers.map((uid, idx) => {
                            const m = members.find(x => x.id === uid)
                            if (!m) return null
                            return (
                              <div key={uid} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <span className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                                <div
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                  style={{ background: m.color_theme ?? '#6366f1' }}
                                >
                                  {(m.full_name ?? '?').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="flex-1 text-sm text-slate-800">
                                  {m.full_name ?? m.email?.split('@')[0]}
                                </span>
                                <div className="flex gap-0.5">
                                  <button type="button" onClick={() => moveMember(idx, -1)} disabled={idx === 0}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                                    <ChevronUpIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => moveMember(idx, 1)} disabled={idx === rotationMembers.length - 1}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                                    <ChevronDownIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Preview */}
                        <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                          <span className="font-semibold">Next up after completion: </span>
                          {(() => {
                            const firstMember = members.find(m => m.id === rotationMembers[0])
                            const secondMember = members.find(m => m.id === rotationMembers[1])
                            return (
                              <>
                                {firstMember?.full_name} → {secondMember?.full_name}
                                {rotationMembers.length > 2 && ` → … → ${firstMember?.full_name}`}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )}

                    {rotationMembers.length === 1 && (
                      <p className="text-xs text-slate-400">Select at least one more member to enable rotation.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" form="chore-form" disabled={isPending} className="btn-primary flex-1">
            {isPending ? (
              <><Spinner /> {isEdit ? 'Saving…' : 'Creating…'}</>
            ) : (
              isEdit ? 'Save Changes' : 'Create Chore'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function ChevronUpIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
