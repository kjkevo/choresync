'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import Image from 'next/image'
import { getChoreComments, addChoreComment, deleteChoreComment } from '@/lib/actions/comments'
import type { ChoreWithAssignee, ChoreCommentWithAuthor } from '@/lib/types/database'

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
}

export default function ChoreCommentsSheet({
  chore, currentUserId, isAdmin, colorMap, onClose,
}: ChoreCommentsSheetProps) {
  const [comments,  setComments]  = useState<ChoreCommentWithAuthor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [input,     setInput]     = useState('')
  const [posting,   startPost]    = useTransition()
  const [error,     setError]     = useState<string | null>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const startY    = useRef<number | null>(null)

  // Load comments on mount
  useEffect(() => {
    getChoreComments(chore.id).then(result => {
      if (result.data) setComments(result.data)
      setLoading(false)
    })
  }, [chore.id])

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
