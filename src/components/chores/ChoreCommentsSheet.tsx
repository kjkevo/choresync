'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import Image from 'next/image'
import { getChoreComments, addChoreComment, deleteChoreComment } from '@/lib/actions/comments'
import { getLatestCompletionForChore, addCompletionReaction, removeCompletionReaction } from '@/lib/actions/reactions'
import type { ChoreWithAssignee, ChoreCommentWithAuthor } from '@/lib/types/database'

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎉', '💪', '😂'] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChoreCommentsSheetProps {
  chore:         ChoreWithAssignee
  currentUserId: string
  isAdmin:       boolean
  colorMap:      Record<string, string>
  onClose:       () => void
  /** Name of the user who completed the chore (for the completion card) */
  completedByName?: string | null
}

export default function ChoreCommentsSheet({
  chore, currentUserId, isAdmin, colorMap, onClose, completedByName,
}: ChoreCommentsSheetProps) {
  const [comments,      setComments]      = useState<ChoreCommentWithAuthor[]>([])
  const [loading,       setLoading]       = useState(true)
  const [input,         setInput]         = useState('')
  const [posting,       startPost]        = useTransition()
  const [error,         setError]         = useState<string | null>(null)
  const [completionId,  setCompletionId]  = useState<string | null>(null)
  const [reactions,     setReactions]     = useState<{ emoji: string; userId: string }[]>([])
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [, startReact]                    = useTransition()
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const startY    = useRef<number | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Load comments on mount
  useEffect(() => {
    getChoreComments(chore.id).then(result => {
      if (result.data) setComments(result.data)
      setLoading(false)
    })
  }, [chore.id])

  // Load completion + reactions if chore is completed
  useEffect(() => {
    if (chore.status !== 'completed') return
    getLatestCompletionForChore(chore.id).then(res => {
      if (res.completionId) {
        setCompletionId(res.completionId)
        setReactions(res.reactions)
      }
    })
  }, [chore.id, chore.status])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  // Focus input after open
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Swipe to close
  function onTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function onTouchEnd(e: React.TouchEvent) {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 80) onClose()
    startY.current = null
  }

  async function handlePost() {
    const text = input.trim()
    if (!text || posting) return
    setError(null)
    setInput('')

    startPost(async () => {
      const result = await addChoreComment(chore.id, text)
      if (result.error) {
        setError(result.error)
      } else if (result.comment) {
        // Optimistic: add with minimal author info
        const optimistic: ChoreCommentWithAuthor = {
          ...result.comment,
          author: null,   // will be correct after next reload
        }
        setComments(prev => [...prev, optimistic])
      }
    })
  }

  function handleReactionToggle(emoji: string) {
    if (!completionId) return
    const alreadyReacted = reactions.some(r => r.emoji === emoji && r.userId === currentUserId)
    // Optimistic
    if (alreadyReacted) {
      setReactions(prev => prev.filter(r => !(r.emoji === emoji && r.userId === currentUserId)))
    } else {
      setReactions(prev => [...prev, { emoji, userId: currentUserId }])
    }
    startReact(async () => {
      if (alreadyReacted) {
        await removeCompletionReaction(completionId, emoji)
      } else {
        // We need household_id — get it from the chore
        await addCompletionReaction(completionId, emoji, chore.household_id)
      }
    })
  }

  async function handleDelete(commentId: string) {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await deleteChoreComment(commentId)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 truncate">📝 Notes — {chore.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Leave notes for your household members
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Completion event card */}
          {chore.status === 'completed' && chore.completed_by && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: colorMap[chore.completed_by] ?? '#10b981' }}
                >
                  {chore.assignee?.avatar_url ? (
                    <Image
                      src={chore.assignee.avatar_url}
                      alt={chore.assignee.full_name ?? ''}
                      width={36} height={36}
                      className="h-full w-full rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    initials(completedByName ?? chore.assignee?.full_name ?? null)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800">
                    {chore.completed_by === currentUserId
                      ? 'You'
                      : (completedByName ?? 'A member')}{' '}
                    marked this done ✅
                  </p>
                  {chore.completed_at && (
                    <p className="text-xs text-emerald-600">{formatTime(chore.completed_at)}</p>
                  )}
                </div>
              </div>

              {/* Photo proof thumbnail */}
              {chore.photo_proof_url && (
                <a href={chore.photo_proof_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chore.photo_proof_url}
                    alt="Photo proof"
                    className="max-h-40 w-full rounded-xl object-cover"
                  />
                </a>
              )}

              {/* Reaction bar */}
              {completionId && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Grouped reaction pills */}
                  {(() => {
                    const grouped: Record<string, string[]> = {}
                    for (const r of reactions) {
                      ;(grouped[r.emoji] ??= []).push(r.userId)
                    }
                    return Object.entries(grouped).map(([emoji, users]) => {
                      const mine = users.includes(currentUserId)
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReactionToggle(emoji)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                            mine
                              ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50'
                          }`}
                        >
                          {emoji} {users.length}
                        </button>
                      )
                    })
                  })()}

                  {/* Picker */}
                  <div ref={pickerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(v => !v)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-slate-400 transition hover:bg-slate-100"
                      aria-label="Add reaction"
                    >
                      +
                    </button>
                    {pickerOpen && (
                      <div className="absolute bottom-8 left-0 z-50 flex gap-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-lg">
                        {REACTION_EMOJIS.map(emoji => {
                          const mine = reactions.some(r => r.emoji === emoji && r.userId === currentUserId)
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => { setPickerOpen(false); handleReactionToggle(emoji) }}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition ${mine ? 'bg-indigo-100' : 'hover:bg-slate-100'}`}
                              aria-label={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl">💬</p>
              <p className="mt-2 font-semibold text-slate-600">No notes yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Add a note to let others know something about this chore.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => {
                const isMe    = comment.user_id === currentUserId
                const canDel  = isMe || isAdmin
                const color   = colorMap[comment.user_id] ?? '#6366f1'
                const name    = comment.author?.full_name ?? 'Member'

                return (
                  <div key={comment.id} className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      {comment.author?.avatar_url ? (
                        <Image
                          src={comment.author.avatar_url}
                          alt={name}
                          width={32} height={32}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        initials(name)
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold" style={{ color }}>
                          {isMe ? 'You' : name}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(comment.created_at)}</span>
                      </div>
                      <div className="mt-1 rounded-xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {comment.content}
                      </div>
                    </div>

                    {/* Delete */}
                    {canDel && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="mt-5 flex-shrink-0 rounded-full p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                        title="Delete note"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="flex-shrink-0 px-5 pb-2 text-xs font-semibold text-red-600">{error}</p>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note… (Enter to post)"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            <button
              type="button"
              onClick={handlePost}
              disabled={!input.trim() || posting}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-40 active:scale-95"
              aria-label="Post note"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
