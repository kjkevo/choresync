'use client'

import { useState, useTransition } from 'react'
import { toggleSubtask } from '@/lib/actions/chores'
import type { ChoreWithAssignee, SubtaskItem } from '@/lib/types/database'

interface Props {
  chore:     ChoreWithAssignee
  onClose:   () => void
  onUpdated: (choreId: string, subtasks: SubtaskItem[]) => void
}

export default function SubtasksSheet({ chore, onClose, onUpdated }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = Array.isArray((chore as any).subtasks) ? (chore as any).subtasks as SubtaskItem[] : []
  const [items, setItems] = useState<SubtaskItem[]>(raw)
  const [, startTransition] = useTransition()

  function toggle(item: SubtaskItem) {
    const newCompleted = !item.completed
    setItems(prev => prev.map(s => s.id === item.id ? { ...s, completed: newCompleted } : s))
    startTransition(async () => {
      const result = await toggleSubtask(chore.id, item.id, newCompleted)
      if (result?.error) {
        setItems(prev => prev.map(s => s.id === item.id ? { ...s, completed: item.completed } : s))
      } else {
        onUpdated(chore.id, items.map(s => s.id === item.id ? { ...s, completed: newCompleted } : s))
      }
    })
  }

  const doneCount = items.filter(s => s.completed).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Checklist</h2>
            <p className="text-xs text-slate-400 mt-0.5">{chore.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                {doneCount}/{items.length}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {items.length > 0 && (
          <div className="h-1.5 bg-slate-100">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-4xl">☑️</div>
              <p className="text-sm text-slate-400">No checklist items for this chore.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition
                      ${item.completed
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                  >
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition
                      ${item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                      {item.completed && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {doneCount === items.length && items.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4 text-center">
            <p className="text-sm font-semibold text-emerald-600">🎉 All steps complete!</p>
          </div>
        )}
      </div>
    </div>
  )
}
