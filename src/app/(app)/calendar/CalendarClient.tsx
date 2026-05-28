'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { CATEGORY_META } from '@/components/chores/ChoreModal'
import type { ChoreWithAssignee } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day'

interface CalendarMember {
  id:        string
  name:      string | null
  avatarUrl: string | null
  color:     string
}

interface CalendarClientProps {
  chores:        ChoreWithAssignee[]
  members:       CalendarMember[]
  currentUserId: string
  householdName: string
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  // Use local date parts to avoid UTC shift
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthYear(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDayFull(iso: string) {
  const d = parseLocalDate(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatWeekRange(days: Date[]) {
  const s = days[0], e = days[6]
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const DAY_LABELS       = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[][] {
  const firstDay  = new Date(year, month, 1)
  const lastDay   = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - firstDay.getDay())
  const endDate = new Date(lastDay)
  endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()))

  const weeks: { date: Date; inMonth: boolean }[][] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    const week: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(current), inMonth: current.getMonth() === month })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function getWeekDays(anchor: Date): Date[] {
  const start = new Date(anchor)
  start.setDate(anchor.getDate() - anchor.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home'    },
  { href: '/chores',    label: 'Chores'  },
  { href: '/calendar',  label: '📅',     active: true },
  { href: '/social',    label: '💬'      },
  { href: '/history',   label: '📊'      },
  { href: '/rewards',   label: '🏆'      },
  { href: '/supplies',  label: '🛒'      },
  { href: '/household', label: 'House'   },
  { href: '/settings',  label: '⚙️'      },
  { href: '/profile',   label: 'Profile' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarClient({
  chores,
  members,
  currentUserId,
  householdName,
}: CalendarClientProps) {
  const today = new Date()
  const todayIso = toDateStr(today)

  const [viewMode,      setViewMode]      = useState<ViewMode>('month')
  const [anchor,        setAnchor]        = useState(today)
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null)
  const [filterMember,  setFilterMember]  = useState<string | null>(null)

  // Filtered chores
  const filteredChores = useMemo(() =>
    filterMember ? chores.filter(c => c.assigned_to === filterMember) : chores,
    [chores, filterMember],
  )

  // Index by due_date
  const choresByDate = useMemo(() => {
    const map = new Map<string, ChoreWithAssignee[]>()
    for (const c of filteredChores) {
      if (!c.due_date) continue
      const list = map.get(c.due_date) ?? []
      list.push(c)
      map.set(c.due_date, list)
    }
    return map
  }, [filteredChores])

  const memberColorById = useMemo(
    () => Object.fromEntries(members.map(m => [m.id, m.color])),
    [members],
  )

  // Navigation
  function prevPeriod() {
    setAnchor(a => {
      const d = new Date(a)
      if (viewMode === 'month')      d.setMonth(d.getMonth() - 1)
      else if (viewMode === 'week')  d.setDate(d.getDate() - 7)
      else                           d.setDate(d.getDate() - 1)
      return d
    })
  }
  function nextPeriod() {
    setAnchor(a => {
      const d = new Date(a)
      if (viewMode === 'month')      d.setMonth(d.getMonth() + 1)
      else if (viewMode === 'week')  d.setDate(d.getDate() + 7)
      else                           d.setDate(d.getDate() + 1)
      return d
    })
  }
  function goToToday() { setAnchor(new Date()) }

  function switchView(v: ViewMode) {
    setViewMode(v)
    setAnchor(new Date())
    setSelectedDate(null)
  }

  function periodLabel() {
    if (viewMode === 'month') return formatMonthYear(anchor)
    if (viewMode === 'week')  return formatWeekRange(getWeekDays(anchor))
    return anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const selectedDayChores = selectedDate ? (choresByDate.get(selectedDate) ?? []) : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)' }}>
      {/* Nav */}
      <header className="app-header">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>{householdName}</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, active }) => (
              <a key={href} href={href} className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-28">

        {/* Controls */}
        <div className="mb-4 space-y-3">

          {/* Navigation row */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevPeriod}
              className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 transition"
              aria-label="Previous"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={goToToday}
              className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition"
            >
              Today
            </button>
            <button
              onClick={nextPeriod}
              className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 transition"
              aria-label="Next"
            >
              <ChevronRightIcon />
            </button>

            <h2 className="flex-1 truncate text-center text-sm font-bold text-slate-900 px-1">
              {periodLabel()}
            </h2>

            {/* View toggle */}
            <div className="flex flex-shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              {(['month', 'week', 'day'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                    viewMode === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Member filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterMember(null)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filterMember === null
                  ? 'bg-slate-800 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {members.map(m => {
              const isMe     = m.id === currentUserId
              const isActive = filterMember === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setFilterMember(isActive ? null : m.id)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isActive ? 'text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={isActive ? { background: m.color } : undefined}
                >
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: m.color }}
                  />
                  {isMe ? 'Me' : (m.name ?? 'Unknown')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Calendar body */}
        {viewMode === 'month' && (
          <MonthView
            anchor={anchor}
            choresByDate={choresByDate}
            todayIso={todayIso}
            memberColorById={memberColorById}
            onSelectDate={d => setSelectedDate(d === selectedDate ? null : d)}
            selectedDate={selectedDate}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            anchor={anchor}
            choresByDate={choresByDate}
            todayIso={todayIso}
            memberColorById={memberColorById}
            onSelectDate={d => setSelectedDate(d === selectedDate ? null : d)}
            selectedDate={selectedDate}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            anchor={anchor}
            choresByDate={choresByDate}
            members={members}
            todayIso={todayIso}
          />
        )}

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          <LegendItem
            dot={<div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"><CheckIcon className="h-2.5 w-2.5 text-white" /></div>}
            label="Completed"
          />
          <LegendItem
            dot={<div className="h-3 w-3 rounded-full bg-indigo-400" />}
            label="Incomplete"
          />
          <LegendItem
            dot={<div className="h-3 w-3 rounded-full bg-red-400" />}
            label="Overdue"
          />
          <LegendItem
            dot={<div className="h-3 w-3 rounded-full border-2 border-slate-300" />}
            label="Unassigned"
          />
        </div>

        {/* Member color key */}
        {members.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <span className="text-xs text-slate-500">
                  {m.id === currentUserId ? `${m.name ?? 'Me'} (you)` : (m.name ?? 'Unknown')}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Day detail sheet */}
      {selectedDate && viewMode !== 'day' && (
        <DaySheet
          dateIso={selectedDate}
          chores={selectedDayChores}
          members={members}
          currentUserId={currentUserId}
          todayIso={todayIso}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  anchor, choresByDate, todayIso, memberColorById, onSelectDate, selectedDate,
}: {
  anchor:          Date
  choresByDate:    Map<string, ChoreWithAssignee[]>
  todayIso:        string
  memberColorById: Record<string, string>
  onSelectDate:    (iso: string) => void
  selectedDate:    string | null
}) {
  const grid = getMonthGrid(anchor.getFullYear(), anchor.getMonth())

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Day header row */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-50 last:border-b-0">
          {week.map(({ date, inMonth }) => {
            const iso       = toDateStr(date)
            const dayChores = choresByDate.get(iso) ?? []
            const isToday   = iso === todayIso
            const isSelected = iso === selectedDate
            const isPast    = iso < todayIso && !isToday
            const MAX_DOTS  = 6
            const overflow  = Math.max(0, dayChores.length - MAX_DOTS)

            const incompleteCount = dayChores.filter(c => c.status !== 'completed').length
            const hasOverdue = dayChores.some(c => c.status !== 'completed' && c.due_date && c.due_date < todayIso)

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={`relative min-h-[80px] p-1.5 text-left transition sm:min-h-[96px] sm:p-2
                  ${!inMonth ? 'bg-slate-50/70' : ''}
                  ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/30' : 'hover:bg-slate-50'}
                  ${hasOverdue && !isSelected ? 'bg-red-50/20' : ''}`}
              >
                {/* Date number */}
                <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                  ${isToday
                    ? 'bg-indigo-600 text-white'
                    : inMonth
                      ? isPast ? 'text-slate-400' : 'text-slate-800'
                      : 'text-slate-300'
                  }`}>
                  {date.getDate()}
                </div>

                {/* Chore dots */}
                <div className="flex flex-wrap gap-[3px]">
                  {dayChores.slice(0, MAX_DOTS).map(chore => {
                    const done = chore.status === 'completed'
                    const isOverdueChore = !done && chore.due_date && chore.due_date < todayIso
                    const color = isOverdueChore
                      ? '#f87171'
                      : done
                        ? '#22c55e'
                        : chore.assigned_to
                          ? (memberColorById[chore.assigned_to] ?? '#94a3b8')
                          : '#94a3b8'

                    return (
                      <div
                        key={chore.id}
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${done ? 'opacity-70' : ''}`}
                        style={{ background: color }}
                        title={`${chore.name}${done ? ' ✓' : ''}`}
                      />
                    )
                  })}
                  {overflow > 0 && (
                    <span className="text-[9px] font-bold leading-none text-slate-400 self-center">+{overflow}</span>
                  )}
                </div>

                {/* Incomplete count badge (mobile-friendly summary) */}
                {incompleteCount > 0 && (
                  <div className={`absolute bottom-1 right-1 hidden rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none sm:block
                    ${hasOverdue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                    {incompleteCount}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  anchor, choresByDate, todayIso, memberColorById, onSelectDate, selectedDate,
}: {
  anchor:          Date
  choresByDate:    Map<string, ChoreWithAssignee[]>
  todayIso:        string
  memberColorById: Record<string, string>
  onSelectDate:    (iso: string) => void
  selectedDate:    string | null
}) {
  const days = getWeekDays(anchor)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7">
        {days.map(day => {
          const iso       = toDateStr(day)
          const dayChores = choresByDate.get(iso) ?? []
          const isToday   = iso === todayIso
          const isSelected = iso === selectedDate
          const hasOverdue = dayChores.some(c => c.status !== 'completed' && c.due_date && c.due_date < todayIso)

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`flex flex-col border-r border-slate-100 p-2 text-left transition last:border-r-0 min-h-[160px]
                ${isSelected ? 'bg-indigo-50/60 ring-2 ring-inset ring-indigo-400' : hasOverdue ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50'}`}
            >
              {/* Day header */}
              <div className="mb-2 text-center w-full">
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  {DAY_LABELS_SHORT[day.getDay()]}
                </p>
                <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                  ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Chore chips */}
              <div className="w-full space-y-0.5 overflow-hidden">
                {dayChores.slice(0, 5).map(chore => {
                  const done = chore.status === 'completed'
                  const isOverdueChore = !done && chore.due_date && chore.due_date < todayIso
                  const color = isOverdueChore
                    ? '#f87171'
                    : chore.assigned_to
                      ? (memberColorById[chore.assigned_to] ?? '#94a3b8')
                      : '#94a3b8'

                  return (
                    <div
                      key={chore.id}
                      className={`w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight text-white ${
                        done ? 'opacity-60' : ''
                      }`}
                      style={{ background: done ? '#22c55e' : color }}
                      title={chore.name}
                    >
                      {done ? '✓ ' : ''}{chore.name}
                    </div>
                  )
                })}
                {dayChores.length > 5 && (
                  <p className="text-[9px] font-bold text-slate-400">+{dayChores.length - 5} more</p>
                )}
                {dayChores.length === 0 && (
                  <p className="text-[10px] text-slate-300 text-center mt-2">—</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({
  anchor, choresByDate, members, todayIso,
}: {
  anchor:       Date
  choresByDate: Map<string, ChoreWithAssignee[]>
  members:      CalendarMember[]
  todayIso:     string
}) {
  const iso       = toDateStr(anchor)
  const dayChores = choresByDate.get(iso) ?? []
  const memberById = Object.fromEntries(members.map(m => [m.id, m]))
  const isToday   = iso === todayIso

  const incomplete = dayChores.filter(c => c.status !== 'completed')
  const completed  = dayChores.filter(c => c.status === 'completed')

  return (
    <div className="space-y-3">
      {/* Day hero */}
      <div className={`rounded-2xl px-4 py-3 ${
        isToday
          ? 'bg-indigo-600 text-white'
          : iso < todayIso
            ? 'bg-slate-700 text-white'
            : 'bg-white border border-slate-200'
      }`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-200' : iso < todayIso ? 'text-slate-400' : 'text-slate-400'}`}>
          {isToday ? 'Today' : iso < todayIso ? 'Past' : 'Upcoming'}
        </p>
        <p className={`text-base font-bold ${isToday || iso < todayIso ? 'text-white' : 'text-slate-900'}`}>
          {anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <p className={`text-sm mt-0.5 ${isToday ? 'text-indigo-200' : iso < todayIso ? 'text-slate-400' : 'text-slate-500'}`}>
          {dayChores.length === 0
            ? 'No chores'
            : `${incomplete.length} incomplete · ${completed.length} done`}
        </p>
      </div>

      {dayChores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 font-semibold text-slate-600">Nothing due this day</p>
          <p className="mt-1 text-sm text-slate-400">Navigate with the arrows to see other days.</p>
        </div>
      ) : (
        <>
          {incomplete.length > 0 && (
            <div className="space-y-2">
              {completed.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Incomplete</p>
              )}
              {incomplete.map(chore => (
                <ChoreDetailCard key={chore.id} chore={chore} memberById={memberById} todayIso={todayIso} />
              ))}
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-2">Completed</p>
              {completed.map(chore => (
                <ChoreDetailCard key={chore.id} chore={chore} memberById={memberById} todayIso={todayIso} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Day detail bottom sheet ───────────────────────────────────────────────────

function DaySheet({
  dateIso, chores, members, currentUserId, todayIso, onClose,
}: {
  dateIso:       string
  chores:        ChoreWithAssignee[]
  members:       CalendarMember[]
  currentUserId: string
  todayIso:      string
  onClose:       () => void
}) {
  const memberById = Object.fromEntries(members.map(m => [m.id, m]))
  const isOverdue  = dateIso < todayIso
  const isToday    = dateIso === todayIso
  const incomplete = chores.filter(c => c.status !== 'completed')
  const completed  = chores.filter(c => c.status === 'completed')

  // Swipe-to-close via touch
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY   = useRef<number | null>(null)

  function onTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function onTouchEnd(e: React.TouchEvent) {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 80) onClose()
    startY.current = null
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="font-bold text-slate-900">{formatDayFull(dateIso)}</p>
            <p className={`text-xs font-semibold ${isToday ? 'text-indigo-600' : isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
              {isToday ? '✦ Today' : isOverdue ? '⚠ Past due' : '→ Upcoming'}
              {' · '}{chores.length} chore{chores.length !== 1 ? 's' : ''}
              {completed.length > 0 && ` · ${completed.length} done`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Chore list */}
        <div className="flex-1 overflow-y-auto">
          {chores.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-2 font-semibold text-slate-600">No chores this day</p>
            </div>
          ) : (
            <div className="space-y-2 p-4 pb-8">
              {incomplete.length > 0 && (
                <>
                  {completed.length > 0 && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      To do ({incomplete.length})
                    </p>
                  )}
                  {incomplete.map(chore => (
                    <ChoreDetailCard
                      key={chore.id}
                      chore={chore}
                      memberById={memberById}
                      todayIso={todayIso}
                      highlightMe={chore.assigned_to === currentUserId}
                    />
                  ))}
                </>
              )}
              {completed.length > 0 && (
                <>
                  <p className={`text-xs font-semibold uppercase tracking-wide text-slate-400 ${incomplete.length > 0 ? 'mt-4' : ''} mb-1`}>
                    Completed ({completed.length})
                  </p>
                  {completed.map(chore => (
                    <ChoreDetailCard
                      key={chore.id}
                      chore={chore}
                      memberById={memberById}
                      todayIso={todayIso}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Shared chore detail card ──────────────────────────────────────────────────

function ChoreDetailCard({
  chore, memberById, todayIso, highlightMe = false,
}: {
  chore:       ChoreWithAssignee
  memberById:  Record<string, CalendarMember>
  todayIso:    string
  highlightMe?: boolean
}) {
  const member     = chore.assigned_to ? memberById[chore.assigned_to] : null
  const color      = member?.color ?? '#94a3b8'
  const done       = chore.status === 'completed'
  const isOverdue  = !done && !!chore.due_date && chore.due_date < todayIso
  const catMeta    = CATEGORY_META[chore.category as keyof typeof CATEGORY_META] ?? { emoji: '📋', label: chore.category }

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition
      ${done
        ? 'border-emerald-100 bg-emerald-50/50'
        : isOverdue
          ? 'border-red-200 bg-red-50/40'
          : highlightMe
            ? 'border-indigo-200 bg-indigo-50/40'
            : 'border-slate-100 bg-white'
      }`}>

      {/* Member color bar */}
      <div
        className="h-10 w-1 flex-shrink-0 rounded-full"
        style={{ background: done ? '#22c55e' : color }}
      />

      {/* Category emoji */}
      <span className="text-xl leading-none flex-shrink-0">{catMeta.emoji}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${done ? 'text-slate-400 line-through decoration-slate-400' : 'text-slate-900'}`}>
          {chore.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {member && (
            <span className="font-medium" style={{ color: done ? '#94a3b8' : color }}>
              {member.name ?? 'Unknown'}
            </span>
          )}
          {!member && (
            <span className="text-slate-400">Unassigned</span>
          )}
          {chore.points > 0 && <span className="text-slate-400">🏆 {chore.points} pts</span>}
          {chore.frequency !== 'one-time' && (
            <span className="text-slate-400">🔁 {chore.frequency}</span>
          )}
          {chore.estimated_mins && (
            <span className="text-slate-400">⏱ {chore.estimated_mins} min</span>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {done ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
            <CheckIcon className="h-4 w-4 text-white" />
          </div>
        ) : isOverdue ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
            Overdue
          </span>
        ) : (
          <div className="h-7 w-7 rounded-full border-2 border-slate-200" />
        )}
      </div>
    </div>
  )
}

// ── Legend helper ─────────────────────────────────────────────────────────────

function LegendItem({ dot, label }: { dot: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot}
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
