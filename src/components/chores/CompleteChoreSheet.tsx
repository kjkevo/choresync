'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { completeChore, uploadChorePhoto } from '@/lib/actions/chores'
import type { ChoreWithAssignee } from '@/lib/types/database'
import { CATEGORY_META } from './ChoreModal'

interface CompleteChoreSheetProps {
  chore:   ChoreWithAssignee
  onClose: () => void
  onDone:  (choreId: string) => void
}

export default function CompleteChoreSheet({ chore, onClose, onDone }: CompleteChoreSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [error,     setError]        = useState<string | null>(null)
  const [photoFile, setPhotoFile]    = useState<File | null>(null)
  const [preview,   setPreview]      = useState<string | null>(null)
  const fileRef                      = useRef<HTMLInputElement>(null)
  const catMeta                      = CATEGORY_META[chore.category]
  const isRecurring                  = chore.frequency !== 'one-time'

  // Keyboard handling
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }

  function handleConfirm() {
    setError(null)

    startTransition(async () => {
      let photoUrl: string | undefined

      // Upload photo first if one is selected
      if (photoFile) {
        const fd = new FormData()
        fd.append('photo', photoFile)
        const uploadResult = await uploadChorePhoto(chore.id, fd)
        if (uploadResult?.error) {
          setError(uploadResult.error)
          return
        }
        photoUrl = uploadResult?.photoUrl
      }

      const result = await completeChore(chore.id, photoUrl)
      if (result?.error) {
        setError(result.error)
      } else {
        onDone(chore.id)
        onClose()
      }
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
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
              {catMeta.emoji}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Mark as complete
              </p>
              <h2 className="font-bold text-slate-900">{chore.name}</h2>
            </div>
          </div>

          {/* Recurring notice */}
          {isRecurring && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-700">
              <span className="mt-0.5 flex-shrink-0 text-base leading-none">🔁</span>
              <p>
                This is a <strong>{chore.frequency}</strong> chore. Completing it will
                automatically schedule the next due date.
              </p>
            </div>
          )}
        </div>

        {/* Photo proof section */}
        <div className="px-6 pb-5">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Add photo proof <span className="text-xs font-normal text-slate-400">(optional)</span>
          </p>

          {preview ? (
            <div className="relative mb-3 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Photo preview"
                className="max-h-48 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500"
            >
              <CameraIcon className="h-7 w-7" />
              <span className="text-sm font-medium">Tap to add photo</span>
              <span className="text-xs">JPG, PNG, WEBP · max 8 MB</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload photo proof"
          />

          {error && (
            <div className="mt-3 alert-error" role="alert">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? (
              <><Spinner /> {photoFile ? 'Uploading…' : 'Saving…'}</>
            ) : (
              <><CheckIcon className="h-4 w-4" /> Mark Done</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function CameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
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
