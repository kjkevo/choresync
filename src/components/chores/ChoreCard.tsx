'use client'

import Image from 'next/image'
import { useState } from 'react'
import { CATEGORY_META, PRIORITY_META, FREQUENCY_OPTIONS } from './ChoreModal'
import type { ChoreWithAssignee } from '@/lib/types/database'
import { parseSubtasks } from '@/lib/types/database'

// ── Color helpers ────────────────────────────────────────────────────────────

const PRIORITY_BAR: Record<string, string> = {
  low:    'bg-emerald-400',
  medium: 'bg-amber-400',
  high:   'bg-red-500',
}

const PRIORITY_TEXT: Record<string, string> = {
  low:    'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-700  bg-amber-50',
  high:   'text-red-600    bg-red-50',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOverdue(dueDateIso: string | null, status: string) {
  if (!dueDateIso || status === 'completed') return false
  const due = new Date(dueDateIso)
  const now = new Date()
  return new Date(due.getFullYear(), due.getMonth(), due.getDate()) <
         new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isDueToday(dueDateIso: string | null) {
  if (!dueDateIso) return false
  const due = new Date(dueDateIso)
  const now = new Date()
  return due.getFullYear() === now.getFullYear() &&
         due.getMonth()    === now.getMonth() &&
         due.getDate()     === now.getDate()
}

function formatDueDate(dueDateIso: string | null): string {
  if (!dueDateIso) return ''
  const d = new Date(dueDateIso)
  if (isDueToday(dueDateIso)) return 'Today'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMins(mins: number | null) {
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function memberInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NextUpPerson {
  id:       string
  name:     string | null
  avatarUrl: string | null
  color:    string
}

interface ChoreCardProps {
  chore:             ChoreWithAssignee
  isAdmin:           boolean
  currentUserId:     string
  assigneeColor?:    string
  nextUpAssignee?:   NextUpPerson     // pre-computed next person in rotation
  commentCount?:     number           // pre-fetched note count badge
  onComplete:        (chore: ChoreWithAssignee) => void
  onEdit?:           (chore: ChoreWithAssignee) => void
  onDelete?:         (chore: ChoreWithAssignee) => void
  onReopen?:         (chore: ChoreWithAssignee) => void
  onSwapRequest?:    (chore: ChoreWithAssignee) => void    // non-admin: request swap
  onManualReassign?: (chore: ChoreWithAssignee) => void   // admin: override assignee
  onNotes?:          (chore: ChoreWithAssignee) => void   // open comments sheet
  onSubtasks?:       (chore: ChoreWithAssignee) => void
  onNudge?:          (chore: ChoreWithAssignee) => Promise<{ error?: string }> // nudge assignee
}

export default function ChoreCard({
  chore,
  isAdmin,
  currentUserId,
  assigneeColor = '#6366f1',
  nextUpAssignee,
  commentCount,
  onComplete,
  onEdit,
  onDelete,
  onReopen,
  onSwapRequest,
  onManualReassign,
  onNotes,
  onSubtasks,
  onNudge,
}: ChoreCardProps) {
  const overdue   = isOverdue(chore.due_date, chore.status)
  const dueToday  = isDueToday(chore.due_date)
  const done      = chore.status === 'completed'
  const catMeta   = CATEGORY_META[chore.category]
  const priMeta   = PRIORITY_META[chore.priority]
  const freqLabel = FREQUENCY_OPTIONS.find(f => f.value === chore.frequency)?.label ?? chore.frequency
  const assignee  = chore.assignee
  const timeLabel = formatMins(chore.estimated_mins)

  const isMyChore    = chore.assigned_to === currentUserId
  const isRotating   = chore.rotation_enabled
  const showSwap     = isRotating && isMyChore && !done && !isAdmin && !!onSwapRequest
  const showOverride = isRotating && isAdmin && !done && !!onManualReassign

  // Nudge: show for overdue chores assigned to *someone else*
  const showNudge  = overdue && !!onNudge && !!chore.assigned_to && chore.assigned_to !== currentUserId && !done
  const [nudging,      setNudging]      = useState(false)
  const [nudgeResult,  setNudgeResult]  = useState<'sent' | 'err' | null>(null)

  return (
    <article
      className={`group relative flex gap-0 overflow-hidden rounded-2xl border bg-white shadow-sm transition
        hover:shadow-md
        ${done    ? 'opacity-60 border-slate-100' : 'border-slate-200'}
        ${overdue ? 'border-red-200 bg-red-50/30' : ''}
      `}
    >
      {/* Priority stripe */}
      <div className={`w-1 flex-shrink-0 ${done ? 'bg-slate-200' : PRIORITY_BAR[chore.priority]}`} />

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Top row: check + name + emoji */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => done ? onReopen?.(chore) : onComplete(chore)}
            disabled={done && !isAdmin}
            aria-label={done ? 'Reopen chore' : 'Mark as complete'}
            className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition
              ${done
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : overdue
                  ? 'border-red-400 hover:border-red-500 hover:bg-red-50'
                  : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50'
              }
              disabled:cursor-default disabled:opacity-50
            `}
          >
            {done && <CheckIcon className="h-3.5 w-3.5" />}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`font-semibold leading-snug text-slate-900 ${done ? 'line-through text-slate-400' : ''}`}>
              {chore.name}
            </p>
            {chore.description && (
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{chore.description}</p>
            )}
          </div>

          <span className="flex-shrink-0 text-lg leading-none" title={catMeta.label} aria-label={catMeta.label}>
            {catMeta.emoji}
          </span>
        </div>

        {/* Tag row */}
        <div className="ml-9 flex flex-wrap items-center gap-1.5">
          {/* Priority */}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_TEXT[chore.priority]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_BAR[chore.priority]}`} />
            {priMeta.label}
          </span>

          {/* Points */}
          {chore.points > 0 && (
            <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-700">
              🏆 {chore.points} pts
            </span>
          )}

          {/* Frequency */}
          {chore.frequency !== 'one-time' && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
              🔁 {freqLabel}
            </span>
          )}

          {/* Rotation — Next Up */}
          {isRotating && nextUpAssignee && !done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              <span>Next:</span>
              <div
                className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full text-[8px] font-bold text-white"
                style={{ background: nextUpAssignee.color }}
              >
                {nextUpAssignee.avatarUrl ? (
                  <Image src={nextUpAssignee.avatarUrl} alt={nextUpAssignee.name ?? ''} width={16} height={16} className="h-full w-full object-cover" unoptimized />
                ) : (
                  memberInitials(nextUpAssignee.name)
                )}
              </div>
              <span>{nextUpAssignee.name?.split(' ')[0] ?? '?'}</span>
            </span>
          )}

          {/* Due date */}
          {chore.due_date && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold
              ${overdue ? 'bg-red-100 text-red-600' : dueToday ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {overdue ? '⚠️ ' : '📅 '}
              {overdue ? `Overdue · ${formatDueDate(chore.due_date)}` : formatDueDate(chore.due_date)}
            </span>
          )}

          {/* Est. time */}
          {timeLabel && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              ⏱ {timeLabel}
            </span>
          )}

          {/* Subtask progress */}
          {(() => {
            const subs = parseSubtasks(chore.subtasks)
            if (subs.length === 0) return null
            const doneCount = subs.filter(s => s.completed).length
            return (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSubtasks?.(chore) }}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold transition
                  ${doneCount === subs.length ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
              >
                ☑️ {doneCount}/{subs.length}
              </button>
            )
          })()}

          {/* Photo proof */}
          {chore.photo_proof_url && (
            <a
              href={chore.photo_proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-600 hover:bg-violet-100 transition-colors"
            >
              📷 Proof
            </a>
          )}
        </div>

        {/* Bottom row: assignee + actions */}
        <div className="ml-9 flex items-center justify-between">
          {assignee ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: assigneeColor }}
              >
                {assignee.avatar_url ? (
                  <Image src={assignee.avatar_url} alt={assignee.full_name ?? ''} width={20} height={20} className="h-full w-full object-cover" unoptimized />
                ) : (
                  memberInitials(assignee.full_name)
                )}
              </div>
              <span className="text-xs text-slate-500">
                {assignee.id === currentUserId ? 'You' : assignee.full_name ?? assignee.email?.split('@')[0]}
              </span>
              {isRotating && <span className="text-xs text-violet-400" title="Rotation enabled">🔄</span>}
            </div>
          ) : (
            <span className="text-xs italic text-slate-400">
              {isRotating ? '🔄 Rotation' : 'Unassigned'}
            </span>
          )}

          <div className="flex items-center gap-1">
            {/* Nudge button — overdue chores assigned to someone else */}
            {showNudge && (
              <button
                type="button"
                disabled={nudging || nudgeResult === 'sent'}
                onClick={async () => {
                  setNudging(true)
                  const res = await onNudge!(chore)
                  setNudging(false)
                  setNudgeResult(res.error ? 'err' : 'sent')
                  setTimeout(() => setNudgeResult(null), 3000)
                }}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                  nudgeResult === 'sent'
                    ? 'text-emerald-600 bg-emerald-50'
                    : nudgeResult === 'err'
                    ? 'text-red-500 bg-red-50'
                    : 'text-orange-500 hover:bg-orange-50'
                }`}
                title="Send a friendly nudge"
              >
                {nudging ? '…' : nudgeResult === 'sent' ? '✓ Nudged!' : nudgeResult === 'err' ? '✗ Error' : '👋 Nudge'}
              </button>
            )}

            {/* Non-admin swap request button */}
            {showSwap && (
              <button
                type="button"
                onClick={() => onSwapRequest(chore)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                title="Request a swap"
              >
                Swap →
              </button>
            )}

            {/* Notes button — always visible, any member */}
            {onNotes && (
              <button
                type="button"
                onClick={() => onNotes(chore)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                title="View notes"
                aria-label="View notes"
              >
                <ChatBubbleIcon className="h-3.5 w-3.5" />
                {commentCount != null && commentCount > 0 && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    {commentCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin action buttons */}
            {isAdmin && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {/* Override rotation assignee */}
                {showOverride && (
                  <button
                    type="button"
                    onClick={() => onManualReassign(chore)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                    title="Override rotation assignee"
                    aria-label="Override assignee"
                  >
                    <ShuffleIcon className="h-3.5 w-3.5" />
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(chore)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    title="Edit chore"
                    aria-label="Edit chore"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(chore)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete chore"
                    aria-label="Delete chore"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PencilIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function ChatBubbleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ShuffleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}
