'use client'

import { useState, useTransition } from 'react'
import { createChore } from '@/lib/actions/chores'
import type { ChoreCategory, ChoreFrequency, ChorePriority } from '@/lib/types/database'

interface TemplateChore {
  name:           string
  category:       ChoreCategory
  frequency:      ChoreFrequency
  priority:       ChorePriority
  estimated_mins?: number
  description?:   string
}

interface TemplatePack {
  id:          string
  name:        string
  emoji:       string
  description: string
  chores:      TemplateChore[]
}

const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: 'new-apartment',
    name: 'New Apartment',
    emoji: '🏠',
    description: 'Essential chores for a fresh start in a new place.',
    chores: [
      { name: 'Wash dishes',           category: 'kitchen',  frequency: 'daily',    priority: 'high',   estimated_mins: 15 },
      { name: 'Wipe kitchen counters', category: 'kitchen',  frequency: 'daily',    priority: 'medium', estimated_mins: 5  },
      { name: 'Take out trash',        category: 'general',  frequency: 'weekly',   priority: 'high',   estimated_mins: 5  },
      { name: 'Vacuum floors',         category: 'general',  frequency: 'weekly',   priority: 'medium', estimated_mins: 20 },
      { name: 'Mop floors',            category: 'general',  frequency: 'biweekly', priority: 'medium', estimated_mins: 30 },
      { name: 'Clean bathroom',        category: 'bathroom', frequency: 'weekly',   priority: 'high',   estimated_mins: 30, description: 'Scrub toilet, wipe sink, clean mirror, mop floor.' },
      { name: 'Do laundry',            category: 'laundry',  frequency: 'weekly',   priority: 'medium', estimated_mins: 60 },
      { name: 'Wipe stovetop',         category: 'kitchen',  frequency: 'weekly',   priority: 'low',    estimated_mins: 10 },
      { name: 'Clean microwave',       category: 'kitchen',  frequency: 'monthly',  priority: 'low',    estimated_mins: 10 },
      { name: 'Change bed sheets',     category: 'bedroom',  frequency: 'biweekly', priority: 'medium', estimated_mins: 15 },
    ],
  },
  {
    id: 'college-dorm',
    name: 'College Dorm',
    emoji: '🎓',
    description: 'Quick, shared chores perfect for student living.',
    chores: [
      { name: 'Wash dishes',           category: 'kitchen',  frequency: 'daily',    priority: 'high',   estimated_mins: 10 },
      { name: 'Take out trash',        category: 'general',  frequency: 'weekly',   priority: 'high',   estimated_mins: 5  },
      { name: 'Sweep common area',     category: 'general',  frequency: 'weekly',   priority: 'medium', estimated_mins: 10 },
      { name: 'Clean shared bathroom', category: 'bathroom', frequency: 'weekly',   priority: 'high',   estimated_mins: 20 },
      { name: 'Do laundry',            category: 'laundry',  frequency: 'weekly',   priority: 'medium', estimated_mins: 60 },
      { name: 'Wipe common surfaces',  category: 'general',  frequency: 'weekly',   priority: 'low',    estimated_mins: 10 },
      { name: 'Restock toilet paper',  category: 'bathroom', frequency: 'weekly',   priority: 'medium', estimated_mins: 5  },
      { name: 'Clean fridge',          category: 'kitchen',  frequency: 'monthly',  priority: 'medium', estimated_mins: 20, description: 'Toss old food, wipe shelves.' },
    ],
  },
  {
    id: 'family-home',
    name: 'Family Home',
    emoji: '👨‍👩‍👧‍👦',
    description: 'Comprehensive chores for a busy household.',
    chores: [
      { name: 'Wash dishes',           category: 'kitchen',  frequency: 'daily',    priority: 'high',   estimated_mins: 20 },
      { name: 'Wipe kitchen counters', category: 'kitchen',  frequency: 'daily',    priority: 'medium', estimated_mins: 5  },
      { name: 'Sweep kitchen floor',   category: 'kitchen',  frequency: 'daily',    priority: 'low',    estimated_mins: 10 },
      { name: 'Take out trash',        category: 'general',  frequency: 'weekly',   priority: 'high',   estimated_mins: 5  },
      { name: 'Vacuum all rooms',      category: 'general',  frequency: 'weekly',   priority: 'high',   estimated_mins: 30 },
      { name: 'Mop floors',            category: 'general',  frequency: 'weekly',   priority: 'medium', estimated_mins: 30 },
      { name: 'Clean bathroom',        category: 'bathroom', frequency: 'weekly',   priority: 'high',   estimated_mins: 30, description: 'Scrub toilet, wipe sink, clean mirror, mop floor.' },
      { name: 'Clean second bathroom', category: 'bathroom', frequency: 'biweekly', priority: 'medium', estimated_mins: 25 },
      { name: 'Do laundry',            category: 'laundry',  frequency: 'weekly',   priority: 'medium', estimated_mins: 90 },
      { name: 'Change all bed sheets', category: 'bedroom',  frequency: 'biweekly', priority: 'medium', estimated_mins: 30 },
      { name: 'Mow lawn',              category: 'outdoor',  frequency: 'weekly',   priority: 'medium', estimated_mins: 60 },
      { name: 'Clean fridge',          category: 'kitchen',  frequency: 'monthly',  priority: 'medium', estimated_mins: 20 },
      { name: 'Deep clean oven',       category: 'kitchen',  frequency: 'monthly',  priority: 'low',    estimated_mins: 45 },
      { name: 'Dust ceiling fans',     category: 'general',  frequency: 'monthly',  priority: 'low',    estimated_mins: 15 },
    ],
  },
]

const CATEGORY_EMOJIS: Record<ChoreCategory, string> = {
  kitchen:  '🍳',
  bathroom: '🚿',
  bedroom:  '🛏️',
  outdoor:  '🌿',
  laundry:  '👕',
  general:  '🏠',
}

const FREQ_LABELS: Record<ChoreFrequency, string> = {
  'one-time':  'One-time',
  'daily':     'Daily',
  'weekly':    'Weekly',
  'biweekly':  'Every 2 wks',
  'monthly':   'Monthly',
}

interface Props {
  householdId: string
  onClose:     () => void
  onImported:  (count: number) => void
}

export default function TemplatesSheet({ householdId, onClose, onImported }: Props) {
  const [selectedPack, setSelectedPack] = useState<TemplatePack | null>(null)
  const [importing, startTransition]    = useTransition()
  const [progress, setProgress]         = useState<{ done: number; total: number } | null>(null)
  const [error, setError]               = useState<string | null>(null)

  async function importPack(pack: TemplatePack) {
    setProgress({ done: 0, total: pack.chores.length })
    setError(null)
    let done = 0

    for (const chore of pack.chores) {
      const fd = new FormData()
      fd.set('household_id',     householdId)
      fd.set('name',             chore.name)
      fd.set('category',         chore.category)
      fd.set('frequency',        chore.frequency)
      fd.set('priority',         chore.priority)
      fd.set('estimated_mins',   chore.estimated_mins ? String(chore.estimated_mins) : '')
      fd.set('description',      chore.description ?? '')
      fd.set('points',           chore.priority === 'high' ? '20' : chore.priority === 'medium' ? '10' : '5')
      fd.set('rotation_enabled', 'false')
      fd.set('rotation_members', '[]')
      fd.set('subtasks',         '[]')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createChore(fd) as any
      if (result?.error) {
        setError(`Failed on "${chore.name}": ${result.error}`)
        setProgress(null)
        return
      }
      done++
      setProgress({ done, total: pack.chores.length })
    }

    setProgress(null)
    onImported(pack.chores.length)
    onClose()
  }

  function handleImport(pack: TemplatePack) {
    startTransition(() => { void importPack(pack) })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <div>
            {selectedPack ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPack(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="font-bold text-slate-900">{selectedPack.emoji} {selectedPack.name}</h2>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-slate-900">Chore Templates</h2>
                <p className="text-xs text-slate-400 mt-0.5">Quick-start packs for your household</p>
              </>
            )}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedPack ? (
            <div className="space-y-3 p-5">
              {TEMPLATE_PACKS.map(pack => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                      {pack.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900">{pack.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{pack.description}</p>
                      <p className="mt-1 text-xs font-semibold text-indigo-600">{pack.chores.length} chores included →</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="mb-4 text-sm text-slate-500">{selectedPack.description}</p>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              {progress && (
                <div className="mb-4 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 mb-1">
                    <span>Creating chores…</span>
                    <span>{progress.done}/{progress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-indigo-200">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {selectedPack.chores.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-base leading-none">{CATEGORY_EMOJIS[c.category]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${c.priority === 'high' ? 'text-red-500' : c.priority === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {c.priority === 'high' ? 'Urgent' : c.priority}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] text-slate-400">{FREQ_LABELS[c.frequency]}</span>
                        {c.estimated_mins && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-[10px] text-slate-400">⏱ {c.estimated_mins}m</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {selectedPack && (
          <div className="border-t border-slate-100 px-5 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleImport(selectedPack)}
              disabled={importing || !!progress}
              className="btn-primary w-full"
            >
              {progress ? `Creating… (${progress.done}/${progress.total})` : `Add ${selectedPack.chores.length} Chores to Household`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
