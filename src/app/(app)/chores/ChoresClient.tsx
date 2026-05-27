'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import ChoreCard from '@/components/chores/ChoreCard'
import ChoreModal, { CATEGORY_META } from '@/components/chores/ChoreModal'
import CompleteChoreSheet from '@/components/chores/CompleteChoreSheet'
import ChoreCommentsSheet from '@/components/chores/ChoreCommentsSheet'
import SwapRequestModal, { ManualOverrideModal } from '@/components/chores/SwapRequestModal'
import SubtasksSheet from '@/components/chores/SubtasksSheet'
import TemplatesSheet from '@/components/chores/TemplatesSheet'
import { deleteChore, reopenChore } from '@/lib/actions/chores'
import { respondToSwap, manualOverride } from '@/lib/actions/rotation'
import type {
  ChoreWithAssignee,
  ChoreCategory,
  UserRow,
  SwapRequestWithDetails,
  SubtaskItem,
} from '@/lib/types/database'
import type { NextUpPerson } from '@/components/chores/ChoreCard'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'mine' | 'today' | 'overdue' | 'completed'

const FILTER_LABELS: { key: FilterKey; label: string; emoji: string }[] = [
  { key: 'all',       label: 'All',     emoji: '📋' },
  { key: 'mine',      label: 'Mine',    emoji: '👤' },
  { key: 'today',     label: 'Today',   emoji: '📅' },
  { key: 'overdue',   label: 'Overdue', emoji: '⚠️' },
  { key: 'completed', label: 'Done',    emoji: '✅' },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

interface ChoresClientProps {
  initialChores:    ChoreWithAssignee[]
  members:          (UserRow & { color_theme: string })[]
  householdId:      string
  currentUserId:    string
  isAdmin:          boolean
  colorMap:         Record<string, string>
  pendingSwaps:     SwapRequestWithDetails[]
  pointDefaults?:   { low?: number; medium?: number; high?: number }
  customCategories?: string[]
  commentCounts?:   Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToday() { return new Date().toISOString().split('T')[0] }
function isOverdue(d: string | null, status: string) { return !!d && status !== 'completed' && d < isoToday() }
function isDueToday(d: string | null) { return !!d && d === isoToday() }

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChoresClient({
  initialChores,
  members,
  householdId,
  currentUserId,
  isAdmin,
  colorMap,
  pendingSwaps: initialPendingSwaps,
  pointDefaults,
  customCategories = [],
  commentCounts = {},
}: ChoresClientProps) {
  const router = useRouter()
  const { t } = useLanguage()

  // ── State ─────────────────────────────────────────────────────────────────
  const [chores,        setChores]        = useState<ChoreWithAssignee[]>(initialChores)
  const [pendingSwaps,  setPendingSwaps]  = useState<SwapRequestWithDetails[]>(initialPendingSwaps)
  const [filter,        setFilter]        = useState<FilterKey>('all')
  const [groupByCategory, setGroupBy]     = useState(false)
  const [modalChore,    setModalChore]    = useState<ChoreWithAssignee | null | 'new'>('null' as never)
  const [completeChore, setCompleteChore] = useState<ChoreWithAssignee | null>(null)
  const [swapChore,     setSwapChore]     = useState<ChoreWithAssignee | null>(null)
  const [overrideChore, setOverrideChore] = useState<ChoreWithAssignee | null>(null)
  const [notesChore,    setNotesChore]    = useState<ChoreWithAssignee | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChoreWithAssignee | null>(null)
  const [toast,         setToast]         = useState<string | null>(null)
  const [swapPending,   setSwapPending]   = useState<Set<string>>(new Set())
  const [isDeleting,    startDeleteTx]    = useTransition()
  const [subtasksChore,  setSubtasksChore]  = useState<ChoreWithAssignee | null>(null)
  const [showTemplates,  setShowTemplates]   = useState(false)

  const modalOpen = modalChore !== null && (modalChore as unknown) !== 'null'

  // Member lookup map for rotation calculations
  const membersById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members]
  )

  // ── Toast helper ──────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Compute Next Up for a chore ───────────────────────────────────────────
  const getNextUp = useCallback((chore: ChoreWithAssignee): NextUpPerson | undefined => {
    if (!chore.rotation_enabled || !Array.isArray(chore.rotation_members) || chore.rotation_members.length < 2) return undefined
    const members_ = chore.rotation_members as string[]
    const nextIdx = (chore.rotation_index + 1) % members_.length
    const nextId = members_[nextIdx]
    const m = membersById[nextId]
    if (!m) return undefined
    return { id: m.id, name: m.full_name, avatarUrl: m.avatar_url, color: m.color_theme ?? '#6366f1' }
  }, [membersById])

  // ── Get rotation candidates for swap/override UI ──────────────────────────
  function getSwapCandidates(chore: ChoreWithAssignee) {
    const rotationIds = Array.isArray(chore.rotation_members) ? chore.rotation_members as string[] : []
    const pool = rotationIds.length > 0 ? rotationIds : members.map(m => m.id)
    return pool
      .filter(id => id !== currentUserId)
      .map(id => {
        const m = membersById[id]
        return { id, name: m?.full_name ?? null, avatarUrl: m?.avatar_url ?? null, color: m?.color_theme ?? '#6366f1' }
      })
  }

  function getOverrideCandidates(chore: ChoreWithAssignee) {
    const rotationIds = Array.isArray(chore.rotation_members) ? chore.rotation_members as string[] : []
    const pool = rotationIds.length > 0 ? rotationIds : members.map(m => m.id)
    return pool.map(id => {
      const m = membersById[id]
      return { id, name: m?.full_name ?? null, avatarUrl: m?.avatar_url ?? null, color: m?.color_theme ?? '#6366f1' }
    })
  }

  // ── Optimistic helpers ────────────────────────────────────────────────────
  function handleChoreCreated(chore: ChoreWithAssignee) {
    const assignee = members.find(m => m.id === chore.assigned_to) ?? null
    setChores(prev => [{ ...chore, assignee }, ...prev])
    showToast('Chore created!')
  }

  function handleChoreUpdated(updated: ChoreWithAssignee) {
    const assignee = members.find(m => m.id === updated.assigned_to) ?? null
    setChores(prev => prev.map(c => c.id === updated.id ? { ...updated, assignee } : c))
    showToast('Chore updated!')
  }

  function handleChoreCompleted(choreId: string) {
    setChores(prev => prev.map(c => {
      if (c.id !== choreId) return c
      if (c.frequency === 'one-time') {
        return { ...c, status: 'completed', completed_at: new Date().toISOString(), completed_by: currentUserId }
      }
      return { ...c, last_completed_at: new Date().toISOString() }
    }))
    showToast(
      chores.find(c => c.id === choreId)?.frequency === 'one-time'
        ? 'Chore marked done!'
        : '🔁 Done! Next cycle scheduled.'
    )
    router.refresh()
  }

  function handleChoreReopened(chore: ChoreWithAssignee) {
    startDeleteTx(async () => {
      const result = await reopenChore(chore.id)
      if (result?.error) { showToast(result.error); return }
      setChores(prev => prev.map(c => c.id === chore.id
        ? { ...c, status: 'incomplete', completed_at: null, completed_by: null, photo_proof_url: null }
        : c
      ))
      showToast('Chore reopened.')
    })
  }

  function handleDeleteConfirmed() {
    if (!confirmDelete) return
    const toDelete = confirmDelete
    setConfirmDelete(null)
    startDeleteTx(async () => {
      const result = await deleteChore(toDelete.id)
      if (result?.error) { showToast(result.error); return }
      setChores(prev => prev.filter(c => c.id !== toDelete.id))
      showToast('Chore deleted.')
    })
  }

  // ── Swap request responses ─────────────────────────────────────────────────
  async function handleSwapResponse(swapId: string, accept: boolean) {
    setSwapPending(prev => new Set(prev).add(swapId))
    const result = await respondToSwap(swapId, accept)
    if (result?.error) {
      showToast(result.error)
    } else {
      setPendingSwaps(prev => prev.filter(s => s.id !== swapId))
      showToast(accept ? '✅ Swap accepted!' : 'Swap declined.')
      router.refresh()
    }
    setSwapPending(prev => { const s = new Set(prev); s.delete(swapId); return s })
  }

  // ── Manual override ───────────────────────────────────────────────────────
  async function handleManualOverride(newUserId: string) {
    if (!overrideChore) return
    const choreId = overrideChore.id
    setOverrideChore(null)
    const result = await manualOverride(choreId, newUserId)
    if (result?.error) {
      showToast(result.error)
    } else {
      const newAssignee = membersById[newUserId] ?? null
      setChores(prev => prev.map(c => c.id === choreId
        ? {
            ...c,
            assigned_to:     newUserId,
            assignee:        newAssignee,
            rotation_index:  Array.isArray(c.rotation_members)
                               ? Math.max(0, (c.rotation_members as string[]).indexOf(newUserId))
                               : 0,
          }
        : c
      ))
      showToast(`Reassigned to ${newAssignee?.full_name ?? 'new member'}.`)
    }
  }

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filteredChores = useMemo(() => {
    let list = [...chores]
    switch (filter) {
      case 'mine':      list = list.filter(c => c.assigned_to === currentUserId); break
      case 'today':     list = list.filter(c => isDueToday(c.due_date) && c.status === 'incomplete'); break
      case 'overdue':   list = list.filter(c => isOverdue(c.due_date, c.status)); break
      case 'completed': list = list.filter(c => c.status === 'completed'); break
      default: break
    }

    list.sort((a, b) => {
      const aOver = isOverdue(a.due_date, a.status) ? 0 : 1
      const bOver = isOverdue(b.due_date, b.status) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const aDone = a.status === 'completed' ? 1 : 0
      const bDone = b.status === 'completed' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const aPri = PRIORITY_ORDER[a.priority] ?? 1
      const bPri = PRIORITY_ORDER[b.priority] ?? 1
      if (aPri !== bPri) return aPri - bPri
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })
    return list
  }, [chores, filter, currentUserId])

  const grouped = useMemo(() => {
    if (!groupByCategory) return null
    const map = new Map<ChoreCategory, ChoreWithAssignee[]>()
    for (const c of filteredChores) {
      const arr = map.get(c.category) ?? []
      arr.push(c)
      map.set(c.category, arr)
    }
    return map
  }, [filteredChores, groupByCategory])

  const counts: Record<FilterKey, number> = useMemo(() => ({
    all:       chores.length,
    mine:      chores.filter(c => c.assigned_to === currentUserId).length,
    today:     chores.filter(c => isDueToday(c.due_date) && c.status === 'incomplete').length,
    overdue:   chores.filter(c => isOverdue(c.due_date, c.status)).length,
    completed: chores.filter(c => c.status === 'completed').length,
  }), [chores, currentUserId])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 max-w-xs animate-fade-in rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 font-bold text-slate-900">Delete chore?</h3>
            <p className="mb-6 text-sm text-slate-500">
              "<strong>{confirmDelete.name}</strong>" will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger flex-1" onClick={handleDeleteConfirmed} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <ChoreModal
          householdId={householdId}
          chore={modalChore !== 'new' ? (modalChore as ChoreWithAssignee) : undefined}
          members={members}
          onClose={() => setModalChore(null as never)}
          onSaved={c => {
            if (modalChore === 'new') handleChoreCreated(c as ChoreWithAssignee)
            else handleChoreUpdated(c as ChoreWithAssignee)
          }}
          pointDefaults={pointDefaults}
          customCategories={customCategories}
        />
      )}

      {completeChore && (
        <CompleteChoreSheet
          chore={completeChore}
          onClose={() => setCompleteChore(null)}
          onDone={handleChoreCompleted}
        />
      )}

      {swapChore && (
        <SwapRequestModal
          chore={swapChore}
          members={getSwapCandidates(swapChore)}
          onClose={() => setSwapChore(null)}
          onSent={() => showToast('Swap request sent!')}
        />
      )}

      {overrideChore && (
        <ManualOverrideModal
          chore={overrideChore}
          members={getOverrideCandidates(overrideChore)}
          onClose={() => setOverrideChore(null)}
          onDone={handleManualOverride}
        />
      )}

      {notesChore && (
        <ChoreCommentsSheet
          chore={notesChore}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          colorMap={colorMap}
          onClose={() => setNotesChore(null)}
          completedByName={
            notesChore.completed_by
              ? (members.find(m => m.id === notesChore.completed_by)?.full_name ?? null)
              : null
          }
        />
      )}

      {subtasksChore && (
        <SubtasksSheet
          chore={subtasksChore}
          onClose={() => setSubtasksChore(null)}
          onUpdated={(choreId, newSubtasks) => {
            setChores(prev => prev.map(c => c.id === choreId
              ? { ...c, subtasks: newSubtasks as unknown as import('@/lib/types/database').Json }
              : c
            ))
          }}
        />
      )}

      {showTemplates && (
        <TemplatesSheet
          householdId={householdId}
          onClose={() => setShowTemplates(false)}
          onImported={count => {
            showToast(`✅ ${count} chores added from template!`)
            router.refresh()
          }}
        />
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 pb-20 pt-10 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Chores</h1>
              <p className="mt-0.5 text-sm text-indigo-100">
                {counts.all} total · {counts.overdue > 0 ? `${counts.overdue} overdue · ` : ''}
                {counts.completed} completed
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  📦 Templates
                </button>
                <button
                  type="button"
                  onClick={() => setModalChore('new')}
                  className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <PlusIcon className="h-4 w-4" /> {t('create')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="mx-auto -mt-12 max-w-2xl px-4 pb-24">

        {/* ── Pending swap requests banner ─────────────────────────────── */}
        {pendingSwaps.length > 0 && (
          <div className="mb-4 space-y-2">
            {pendingSwaps.map(swap => (
              <div key={swap.id} className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-violet-900">
                      🔀 Swap request from <strong>{swap.requester?.full_name ?? 'Someone'}</strong>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-violet-700">
                      They want you to take: <strong>{swap.chore?.name ?? 'a chore'}</strong>
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => handleSwapResponse(swap.id, false)}
                      disabled={swapPending.has(swap.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleSwapResponse(swap.id, true)}
                      disabled={swapPending.has(swap.id)}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      {swapPending.has(swap.id) ? '…' : 'Accept'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter chips */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_LABELS.map(({ key, emoji }) => {
            const count = counts[key]
            const active = filter === key
            const labelMap: Record<FilterKey, string> = {
              all:       'All',
              mine:      'Mine',
              today:     t('today'),
              overdue:   t('overdue'),
              completed: t('completed'),
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition
                  ${active
                    ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }
                  ${key === 'overdue' && count > 0 && !active ? 'border-red-300 text-red-600' : ''}
                `}
              >
                <span>{emoji}</span>
                {labelMap[key]}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setGroupBy(v => !v)}
            className={`ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition
              ${groupByCategory ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
          >
            <GridIcon className="h-3.5 w-3.5" /> Group
          </button>
        </div>

        {/* Chore list */}
        {filteredChores.length === 0 ? (
          <EmptyState filter={filter} isAdmin={isAdmin} onAdd={() => setModalChore('new')} />
        ) : grouped ? (
          <div className="space-y-6">
            {(Array.from(grouped.entries()) as [ChoreCategory, ChoreWithAssignee[]][]).map(([cat, catChores]) => (
              <div key={cat}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_META[cat].emoji}</span>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{CATEGORY_META[cat].label}</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">{catChores.length}</span>
                </div>
                <div className="space-y-2">
                  {catChores.map(c => renderCard(c))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChores.map(c => renderCard(c))}
          </div>
        )}
      </div>

      {/* FAB */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setModalChore('new')}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-700 hover:scale-105 active:scale-95 sm:hidden"
          aria-label="Add new chore"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  )

  async function handleNudge(chore: ChoreWithAssignee): Promise<{ error?: string }> {
    try {
      const res = await fetch('/api/push/nudge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ choreId: chore.id, householdId }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.error ?? 'Nudge failed' }
      return {}
    } catch {
      return { error: 'Network error' }
    }
  }

  function renderCard(c: ChoreWithAssignee) {
    return (
      <ChoreCard
        key={c.id}
        chore={c}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        assigneeColor={c.assigned_to ? colorMap[c.assigned_to] : undefined}
        nextUpAssignee={getNextUp(c)}
        commentCount={commentCounts[c.id] ?? 0}
        onComplete={setCompleteChore}
        onEdit={isAdmin ? ch => setModalChore(ch) : undefined}
        onDelete={isAdmin ? setConfirmDelete : undefined}
        onReopen={isAdmin ? handleChoreReopened : undefined}
        onSwapRequest={!isAdmin ? setSwapChore : undefined}
        onManualReassign={isAdmin ? setOverrideChore : undefined}
        onNotes={setNotesChore}
        onSubtasks={setSubtasksChore}
        onNudge={handleNudge}
      />
    )
  }

}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filter, isAdmin, onAdd }: { filter: FilterKey; isAdmin: boolean; onAdd: () => void }) {
  const copy: Record<FilterKey, { emoji: string; title: string; sub: string }> = {
    all:       { emoji: '🧹', title: 'No chores yet',           sub: isAdmin ? 'Create your first chore to get started.' : 'No chores have been added yet.' },
    mine:      { emoji: '👤', title: 'Nothing assigned to you', sub: 'Ask an admin to assign you a chore.' },
    today:     { emoji: '🎉', title: 'All caught up today!',    sub: 'Nothing due today — enjoy the break.' },
    overdue:   { emoji: '✅', title: 'No overdue chores!',      sub: 'Great work keeping on top of things.' },
    completed: { emoji: '📋', title: 'Nothing done yet',        sub: 'Completed chores will appear here.' },
  }
  const { emoji, title, sub } = copy[filter]
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <h3 className="mb-1 font-semibold text-slate-900">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-slate-500">{sub}</p>
      {isAdmin && filter === 'all' && (
        <button type="button" onClick={onAdd} className="btn-primary">
          <PlusIcon className="h-4 w-4" /> Add First Chore
        </button>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function GridIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}
