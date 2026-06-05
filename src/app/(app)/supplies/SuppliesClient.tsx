'use client'

import { useState, useTransition, useOptimistic } from 'react'
import {
  addSupplyItem,
  toggleSupplyItem,
  deleteSupplyItem,
  clearCheckedItems,
} from '@/lib/actions/supplies'
import type { EnrichedSupplyItem } from './page'

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home'     },
  { href: '/chores',    label: 'Chores'   },
  { href: '/calendar',  label: '📅'       },
  { href: '/social',    label: '💬'       },
  { href: '/history',   label: '📊'       },
  { href: '/supplies',  label: '🛒', active: true },
  { href: '/household', label: 'House'    },
  { href: '/settings',  label: '⚙️'       },
  { href: '/profile',   label: 'Profile'  },
]

const CATEGORY_OPTIONS = [
  { value: 'cleaning',   label: '🧹 Cleaning'   },
  { value: 'kitchen',    label: '🍳 Kitchen'    },
  { value: 'bathroom',   label: '🚿 Bathroom'   },
  { value: 'outdoor',    label: '🌿 Outdoor'    },
  { value: 'laundry',    label: '👕 Laundry'    },
  { value: 'general',    label: '🛒 General'    },
]

const CATEGORY_EMOJI: Record<string, string> = {
  cleaning:  '🧹',
  kitchen:   '🍳',
  bathroom:  '🚿',
  outdoor:   '🌿',
  laundry:   '👕',
  general:   '🛒',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  items:            EnrichedSupplyItem[]
  householdId:      string
  currentUserId:    string
  currentUserRole:  'admin' | 'member' | 'kids'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SuppliesClient({ items, householdId, currentUserId }: Props) {
  const [optimisticItems, updateOptimistic] = useOptimistic(
    items,
    (state: EnrichedSupplyItem[], action: { type: 'toggle'; id: string; checked: boolean } | { type: 'delete'; id: string }) => {
      if (action.type === 'toggle') {
        return state.map(i => i.id === action.id ? { ...i, is_checked: action.checked } : i)
      }
      if (action.type === 'delete') {
        return state.filter(i => i.id !== action.id)
      }
      return state
    }
  )

  const [isPending, startTransition] = useTransition()
  const [showChecked, setShowChecked] = useState(true)

  // Add form state
  const [name,     setName]     = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit,     setUnit]     = useState('')
  const [category, setCategory] = useState('general')
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAddError(null)

    const fd = new FormData()
    fd.set('householdId', householdId)
    fd.set('name',        name.trim())
    fd.set('quantity',    quantity)
    fd.set('unit',        unit)
    fd.set('category',    category)

    const result = await addSupplyItem(fd)
    if (result.error) {
      setAddError(result.error)
    } else {
      setName('')
      setQuantity('1')
      setUnit('')
    }
  }

  function handleToggle(item: EnrichedSupplyItem) {
    startTransition(async () => {
      updateOptimistic({ type: 'toggle', id: item.id, checked: !item.is_checked })
      await toggleSupplyItem(item.id, !item.is_checked)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      updateOptimistic({ type: 'delete', id })
      await deleteSupplyItem(id)
    })
  }

  function handleClearChecked() {
    startTransition(async () => {
      await clearCheckedItems(householdId)
    })
  }

  const unchecked = optimisticItems.filter(i => !i.is_checked)
  const checked   = optimisticItems.filter(i => i.is_checked)
  const hasChecked = checked.length > 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)', color: 'var(--cs-text)' }}>

      {/* Header */}
      <header className="app-header">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>Supplies</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, active }) => (
              <a key={href} href={href} className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="hero-strip">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Supply List</h1>
              <p className="mt-0.5 text-sm text-indigo-100">Track what you need for your household chores</p>
            </div>
            {unchecked.length > 0 && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">
                {unchecked.length} item{unchecked.length !== 1 ? 's' : ''} needed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-4 pb-24 -mt-4">
        <div className="space-y-4 animate-in">

          {/* Add item form */}
          <div className="card">
            <h2 className="font-semibold mb-3">Add an item</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              {addError && <div className="alert-error">{addError}</div>}

              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Item name (e.g. Dish soap)"
                  maxLength={100}
                  required
                  autoComplete="off"
                />
                <input
                  className="input w-16 text-center"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="1"
                  maxLength={10}
                  style={{ minWidth: '56px' }}
                />
                <input
                  className="input w-20"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="pcs/kg/L"
                  maxLength={10}
                />
              </div>

              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!name.trim() || isPending}
                  className="btn-primary flex-shrink-0"
                >
                  + Add
                </button>
              </div>
            </form>
          </div>

          {/* Unchecked items */}
          {unchecked.length === 0 && checked.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-4xl mb-3">🛒</p>
              <p className="font-semibold" style={{ color: 'var(--cs-text)' }}>Nothing on the list yet</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--cs-muted)' }}>
                Add supplies you need for your chores
              </p>
            </div>
          )}

          {unchecked.length > 0 && (
            <div className="card space-y-2">
              {unchecked.map(item => (
                <SupplyItemRow
                  key={item.id}
                  item={item}
                  currentUserId={currentUserId}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Checked items */}
          {hasChecked && (
            <div className="card">
              <button
                type="button"
                onClick={() => setShowChecked(v => !v)}
                className="flex w-full items-center justify-between text-sm font-semibold"
                style={{ color: 'var(--cs-muted)' }}
              >
                <span>Checked off ({checked.length})</span>
                <span className="text-lg">{showChecked ? '▾' : '▸'}</span>
              </button>

              {showChecked && (
                <div className="mt-3 space-y-2">
                  {checked.map(item => (
                    <SupplyItemRow
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={handleClearChecked}
                    disabled={isPending}
                    className="mt-2 w-full rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Clear all checked items
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Row sub-component ─────────────────────────────────────────────────────────

function SupplyItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item:          EnrichedSupplyItem
  currentUserId: string
  onToggle:      (item: EnrichedSupplyItem) => void
  onDelete:      (id: string) => void
}) {
  const emoji = CATEGORY_EMOJI[item.category] ?? '🛒'

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
      item.is_checked ? 'opacity-50' : ''
    }`} style={{ background: 'var(--cs-inset)', border: '1px solid var(--cs-border)' }}>
      {/* Checkbox — 44px tap target */}
      <button
        type="button"
        onClick={() => onToggle(item)}
        aria-label={item.is_checked ? 'Uncheck item' : 'Check item'}
        style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="flex-shrink-0 rounded-full"
      >
        <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
          item.is_checked
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 hover:border-indigo-500'
        }`}>
          {item.is_checked && (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </button>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${item.is_checked ? 'line-through' : ''}`} style={{ color: 'var(--cs-text)' }}>
          {item.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {/* Quantity + unit */}
          {(item.quantity || item.unit) && (
            <span className="text-xs" style={{ color: 'var(--cs-muted)' }}>
              {item.quantity}{item.unit ? ` ${item.unit}` : ''}
            </span>
          )}
          {/* Category chip */}
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
            {emoji} {item.category}
          </span>
          {/* Chore link */}
          {item.chore_name && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              🧹 {item.chore_name}
            </span>
          )}
          {/* Added by */}
          {item.addedByName && (
            <span className="text-xs" style={{ color: 'var(--cs-muted)' }}>
              by {item.addedByName}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label="Delete item"
        className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-500"
        style={{ color: 'var(--cs-muted)' }}
      >
        ×
      </button>
    </div>
  )
}
