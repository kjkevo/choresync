'use client'

import React, { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import type {
  ChoreCompletionWithMember,
  AnalyticsSummary,
  MemberStat,
} from '@/lib/types/database'

// ── Constants & helpers ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home'    },
  { href: '/chores',    label: 'Chores'  },
  { href: '/calendar',  label: '📅'      },
  { href: '/social',    label: '💬'      },
  { href: '/history',   label: '📊', active: true },
  { href: '/rewards',   label: '🏆'      },
  { href: '/household', label: 'House'   },
  { href: '/settings',  label: '⚙️'      },
  { href: '/profile',   label: 'Profile' },
]

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  kitchen:  { emoji: '🍽️', label: 'Kitchen'  },
  bathroom: { emoji: '🚿', label: 'Bathroom' },
  bedroom:  { emoji: '🛏️', label: 'Bedroom'  },
  outdoor:  { emoji: '🌿', label: 'Outdoor'  },
  laundry:  { emoji: '👕', label: 'Laundry'  },
  general:  { emoji: '🏠', label: 'General'  },
}

const PAGE_SIZE = 25

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string; name: string | null; avatarUrl: string | null; color: string
}

interface HistoryClientProps {
  householdName:  string
  householdId:    string
  currentUserId:  string
  members:        Member[]
  logEntries:     ChoreCompletionWithMember[]
  weekSummary:    AnalyticsSummary
  monthSummary:   AnalyticsSummary
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoryClient({
  householdName,
  householdId,
  currentUserId,
  members,
  logEntries,
  weekSummary,
  monthSummary,
}: HistoryClientProps) {
  const [tab, setTab] = useState<'log' | 'analytics' | 'export'>('log')

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
        {/* Tab strip */}
        <div className="mx-auto flex max-w-3xl" style={{ borderTop: '1px solid var(--cs-border)' }}>
          {(['log', 'analytics', 'export'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold transition border-b-2
                ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
              style={tab !== t ? { color: 'var(--cs-muted)' } : {}}>
              {t === 'log' ? '📋 History Log' : t === 'analytics' ? '📊 Analytics' : '📥 Export'}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        {tab === 'log' && (
          <LogTab entries={logEntries} members={members} currentUserId={currentUserId} />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab weekSummary={weekSummary} monthSummary={monthSummary} />
        )}
        {tab === 'export' && (
          <ExportTab
            householdName={householdName}
            members={members}
            logEntries={logEntries}
            weekSummary={weekSummary}
            monthSummary={monthSummary}
          />
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LOG TAB
// ══════════════════════════════════════════════════════════════════════════════

function LogTab({
  entries, members, currentUserId,
}: {
  entries:       ChoreCompletionWithMember[]
  members:       Member[]
  currentUserId: string
}) {
  const [search,     setSearch]     = useState('')
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [page,       setPage]       = useState(0)

  const filtered = useMemo(() => {
    let list = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.chore_name.toLowerCase().includes(q))
    }
    if (memberFilter) list = list.filter(e => e.completed_by === memberFilter)
    if (categoryFilter) list = list.filter(e => e.category === categoryFilter)
    return list
  }, [entries, search, memberFilter, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filters change
  const prevFilters = useRef({ search, memberFilter, categoryFilter })
  if (
    prevFilters.current.search !== search ||
    prevFilters.current.memberFilter !== memberFilter ||
    prevFilters.current.categoryFilter !== categoryFilter
  ) {
    prevFilters.current = { search, memberFilter, categoryFilter }
    if (page !== 0) setPage(0)
  }

  const categories = [...new Set(entries.map(e => e.category))]

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chore name…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Member pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterPill active={!memberFilter} onClick={() => setMemberFilter(null)}>All members</FilterPill>
          {members.map(m => (
            <FilterPill
              key={m.id}
              active={memberFilter === m.id}
              color={m.color}
              onClick={() => setMemberFilter(memberFilter === m.id ? null : m.id)}
            >
              {m.id === currentUserId ? 'Me' : (m.name ?? 'Unknown')}
            </FilterPill>
          ))}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterPill active={!categoryFilter} onClick={() => setCategoryFilter(null)}>All categories</FilterPill>
          {categories.map(cat => (
            <FilterPill
              key={cat}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              {CATEGORY_META[cat]?.emoji} {CATEGORY_META[cat]?.label ?? cat}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs font-semibold text-slate-400">
        {filtered.length} completion{filtered.length !== 1 ? 's' : ''}
        {(memberFilter || categoryFilter || search) ? ' (filtered)' : ' in the last 90 days'}
      </p>

      {/* Log list */}
      {pageEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-3xl">📋</p>
          <p className="mt-2 font-semibold text-slate-600">No completions found</p>
          <p className="mt-1 text-sm text-slate-400">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="hidden grid-cols-[2fr_1fr_1fr_80px_64px_40px] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 sm:grid">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chore</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Member</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Timing</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Pts</span>
            <span />
          </div>

          <div className="divide-y divide-slate-50">
            {pageEntries.map(entry => (
              <LogRow key={entry.id} entry={entry} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition"
          >
            ← Prev
          </button>
          <span className="text-xs font-semibold text-slate-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function LogRow({ entry, currentUserId }: { entry: ChoreCompletionWithMember; currentUserId: string }) {
  const cat    = CATEGORY_META[entry.category] ?? { emoji: '🏠', label: entry.category }
  const color  = entry.member?.color ?? '#94a3b8'
  const isMe   = entry.completed_by === currentUserId
  const name   = isMe ? 'You' : (entry.member?.name ?? 'Unknown')

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_80px_64px_40px] sm:gap-4 sm:items-center">
      {/* Chore */}
      <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
        <span className="text-base leading-none flex-shrink-0">{cat.emoji}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{entry.chore_name}</p>
          <p className="text-xs text-slate-400 sm:hidden">{name} · {formatDate(entry.completed_at)}</p>
        </div>
      </div>

      {/* Member (desktop) */}
      <div className="hidden sm:flex items-center gap-1.5">
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-white"
          style={{ background: color }}
        >
          {entry.member?.avatarUrl ? (
            <Image src={entry.member.avatarUrl} alt={name} width={20} height={20} className="h-full w-full object-cover" unoptimized />
          ) : (
            initials(entry.member?.name ?? null)
          )}
        </div>
        <span className="truncate text-xs text-slate-600">{name}</span>
      </div>

      {/* Date (desktop) */}
      <span className="hidden text-xs text-slate-500 sm:block">{formatDateTime(entry.completed_at)}</span>

      {/* Timing badge */}
      <div className="flex items-center sm:col-start-4">
        {entry.was_on_time === true && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">On time</span>
        )}
        {entry.was_on_time === false && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">Late</span>
        )}
        {entry.was_on_time === null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">—</span>
        )}
      </div>

      {/* Points */}
      <div className="hidden text-right sm:block">
        {entry.points > 0 ? (
          <span className="text-xs font-bold text-amber-600">+{entry.points}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>

      {/* Photo */}
      <div className="flex items-center justify-end">
        {entry.photo_proof_url && (
          <a
            href={entry.photo_proof_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1 text-violet-400 hover:bg-violet-50 hover:text-violet-600 transition"
            title="View photo proof"
          >
            <PhotoIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({
  weekSummary, monthSummary,
}: {
  weekSummary:  AnalyticsSummary
  monthSummary: AnalyticsSummary
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const s = period === 'week' ? weekSummary : monthSummary
  const label = period === 'week' ? 'This week' : 'This month'
  const onTimeRate  = pct(s.onTime, s.onTime + s.late)
  const topMember   = s.byMember[0]
  const maxChores   = Math.max(...s.byMember.map(m => m.completions), 1)
  const maxCategory = Math.max(...s.byCategory.map(c => c.count), 1)
  const maxTrend    = Math.max(...s.weeklyTrend.map(t => t.count), 1)

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex justify-end">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {(['week', 'month'] as const).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition
                ${period === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              {p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard emoji="✅" label="Completions" value={String(s.total)} sub={label} color="indigo" />
        <KpiCard
          emoji={onTimeRate >= 80 ? '🎯' : onTimeRate >= 50 ? '⏱️' : '⚠️'}
          label="On-time rate"
          value={s.onTime + s.late === 0 ? '—' : `${onTimeRate}%`}
          sub={`${s.onTime} on time · ${s.late} late`}
          color={onTimeRate >= 80 ? 'emerald' : onTimeRate >= 50 ? 'amber' : 'red'}
        />
        <KpiCard emoji="🏆" label="Points earned" value={String(s.totalPoints)} sub={label} color="amber" />
        <KpiCard
          emoji="⭐"
          label="Top member"
          value={topMember?.name?.split(' ')[0] ?? '—'}
          sub={topMember ? `${topMember.completions} chores` : 'No data yet'}
          color="violet"
        />
      </div>

      {/* Timeliness donut */}
      {(s.onTime + s.late) > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-800">⏱️ Timeliness Breakdown</h3>
          <div className="flex items-center gap-6">
            <DonutChart onTime={s.onTime} late={s.late} noDueDate={s.noDueDate} />
            <div className="flex flex-col gap-2">
              <LegendRow color="#22c55e" label="On time"     value={s.onTime}     total={s.total} />
              <LegendRow color="#f87171" label="Late"        value={s.late}        total={s.total} />
              {s.noDueDate > 0 && (
                <LegendRow color="#94a3b8" label="No due date" value={s.noDueDate} total={s.total} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-member breakdown */}
      {s.byMember.some(m => m.completions > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-800">👥 Per-Member Activity</h3>
          <div className="space-y-3">
            {s.byMember.filter(m => m.completions > 0).map(m => (
              <MemberBar key={m.userId} member={m} max={maxChores} />
            ))}
          </div>
        </div>
      )}

      {/* Weekly trend */}
      {s.weeklyTrend.some(t => t.count > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-800">📈 Weekly Trend (last 8 weeks)</h3>
          <TrendChart trend={s.weeklyTrend} max={maxTrend} />
        </div>
      )}

      {/* Category breakdown */}
      {s.byCategory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-800">🏠 Most Active Categories</h3>
          <div className="space-y-2.5">
            {s.byCategory.map(({ category, count }) => {
              const meta = CATEGORY_META[category] ?? { emoji: '🏠', label: category }
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-24 flex-shrink-0 text-xs font-semibold text-slate-600">
                    {meta.emoji} {meta.label}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2.5">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                      style={{ width: `${pct(count, maxCategory)}%` }}
                    />
                  </div>
                  <span className="w-6 flex-shrink-0 text-right text-xs font-bold text-slate-600">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {s.total === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-3xl">📊</p>
          <p className="mt-2 font-semibold text-slate-600">No data for {label.toLowerCase()}</p>
          <p className="mt-1 text-sm text-slate-400">Complete some chores to see analytics here.</p>
        </div>
      )}
    </div>
  )
}

// ── Analytics sub-components ──────────────────────────────────────────────────

function KpiCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub: string
  color: 'indigo' | 'emerald' | 'amber' | 'red' | 'violet'
}) {
  const colors = {
    indigo:  'text-indigo-700  bg-indigo-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber:   'text-amber-700   bg-amber-50',
    red:     'text-red-700     bg-red-50',
    violet:  'text-violet-700  bg-violet-50',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-lg ${colors[color].split(' ')[1]}`}>
        {emoji}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
    </div>
  )
}

function DonutChart({ onTime, late, noDueDate }: { onTime: number; late: number; noDueDate: number }) {
  const total = onTime + late + noDueDate
  if (total === 0) return null
  const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r

  const segments = [
    { count: onTime,    color: '#22c55e' },
    { count: late,      color: '#f87171' },
    { count: noDueDate, color: '#cbd5e1' },
  ]

  let offset = 0
  const arcs = segments
    .filter(s => s.count > 0)
    .map(s => {
      const dash  = (s.count / total) * circumference
      const arc   = { color: s.color, dasharray: `${dash} ${circumference - dash}`, offset }
      offset += dash
      return arc
    })

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={arc.color} strokeWidth="18"
          strokeDasharray={arc.dasharray}
          strokeDashoffset={-arc.offset}
        />
      ))}
      {/* Centre hole */}
      <circle cx={cx} cy={cy} r={28} fill="white" />
    </svg>
  )
}

function LegendRow({ color, label, value, total }: {
  color: string; label: string; value: number; total: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-xs text-slate-600">{label}</span>
      <span className="ml-auto text-xs font-bold text-slate-800">{value}</span>
      <span className="w-8 text-right text-[10px] text-slate-400">{pct(value, total)}%</span>
    </div>
  )
}

function MemberBar({ member, max }: { member: MemberStat; max: number }) {
  const onTimeRate = pct(member.onTime, member.onTime + member.late)
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
        style={{ background: member.color }}
      >
        {member.avatarUrl ? (
          <Image src={member.avatarUrl} alt={member.name ?? ''} width={28} height={28} className="h-full w-full object-cover" unoptimized />
        ) : (
          initials(member.name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">{member.name ?? 'Unknown'}</span>
          <span className="text-[10px] text-slate-400">
            {member.completions} done · {member.onTime + member.late > 0 ? `${onTimeRate}% on time` : 'no due dates'}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct(member.completions, max)}%`, background: member.color }}
          />
        </div>
      </div>
      <span className="w-6 flex-shrink-0 text-right text-xs font-bold text-slate-700">
        {member.completions}
      </span>
    </div>
  )
}

function TrendChart({ trend, max }: { trend: AnalyticsSummary['weeklyTrend']; max: number }) {
  const w = 100 / trend.length
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-24">
        {trend.map((t, i) => {
          const h = max === 0 ? 0 : Math.max(4, Math.round((t.count / max) * 80))
          const isLast = i === trend.length - 1
          return (
            <div key={t.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1">
              {t.count > 0 && (
                <span className="text-[9px] font-bold text-slate-500">{t.count}</span>
              )}
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                style={{ height: `${h}px` }}
                title={`${t.weekLabel}: ${t.count}`}
              />
            </div>
          )
        })}
      </div>
      {/* X-axis labels — show every other label to avoid crowding */}
      <div className="flex gap-1">
        {trend.map((t, i) => (
          <div key={t.weekStart} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[9px] text-slate-400 leading-none">{t.weekLabel}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT TAB
// ══════════════════════════════════════════════════════════════════════════════

function ExportTab({
  householdName, members, logEntries, weekSummary, monthSummary,
}: {
  householdName: string
  members:       Member[]
  logEntries:    ChoreCompletionWithMember[]
  weekSummary:   AnalyticsSummary
  monthSummary:  AnalyticsSummary
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const summary = period === 'week' ? weekSummary : monthSummary
  const label   = period === 'week' ? 'This Week' : 'This Month'

  // Filter entries to the selected period
  const periodEntries = useMemo(() => {
    const now   = new Date()
    const since = period === 'week'
      ? (() => { const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7)); d.setHours(0,0,0,0); return d })()
      : new Date(now.getFullYear(), now.getMonth(), 1)
    return logEntries.filter(e => new Date(e.completed_at) >= since)
  }, [logEntries, period])

  function downloadCSV() {
    const rows = [
      ['Chore', 'Category', 'Completed By', 'Completed At', 'Timing', 'Points', 'Photo'],
      ...periodEntries.map(e => [
        e.chore_name,
        CATEGORY_META[e.category]?.label ?? e.category,
        e.member?.name ?? 'Unknown',
        new Date(e.completed_at).toLocaleString(),
        e.was_on_time === true ? 'On time' : e.was_on_time === false ? 'Late' : 'No due date',
        String(e.points),
        e.photo_proof_url ?? '',
      ]),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${householdName.replace(/\s+/g, '-')}-${period}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const onTimeRate = pct(summary.onTime, summary.onTime + summary.late)
    const now        = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const tableRows = periodEntries.map(e => `
      <tr>
        <td>${CATEGORY_META[e.category]?.emoji ?? ''} ${e.chore_name}</td>
        <td>${e.member?.name ?? 'Unknown'}</td>
        <td>${new Date(e.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
        <td><span class="badge ${e.was_on_time === true ? 'on-time' : e.was_on_time === false ? 'late' : 'none'}">
          ${e.was_on_time === true ? 'On time' : e.was_on_time === false ? 'Late' : '—'}
        </span></td>
        <td class="pts">${e.points > 0 ? `+${e.points}` : '—'}</td>
        ${e.photo_proof_url ? `<td><a href="${e.photo_proof_url}" target="_blank">📷 View</a></td>` : '<td>—</td>'}
      </tr>`)
    .join('')

    const memberRows = summary.byMember.filter(m => m.completions > 0).map(m => `
      <tr>
        <td>${m.name ?? 'Unknown'}</td>
        <td>${m.completions}</td>
        <td>${m.onTime + m.late > 0 ? `${pct(m.onTime, m.onTime + m.late)}%` : '—'}</td>
        <td>${m.points}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${householdName} — ${label} Report</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1e293b; padding:40px; font-size:13px; line-height:1.5; }
    .header { margin-bottom:32px; }
    .header h1 { font-size:22px; font-weight:700; color:#1e293b; }
    .header .sub { color:#64748b; font-size:13px; margin-top:4px; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
    .stat { background:#f8fafc; border-radius:12px; padding:14px; text-align:center; border:1px solid #e2e8f0; }
    .stat .num { font-size:26px; font-weight:700; color:#4f46e5; }
    .stat .lbl { font-size:11px; color:#64748b; margin-top:3px; }
    .section { margin-bottom:28px; }
    .section h2 { font-size:14px; font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:12px; color:#374151; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:8px 10px; background:#f8fafc; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; border-bottom:1px solid #e5e7eb; }
    td { padding:8px 10px; border-bottom:1px solid #f1f5f9; font-size:12px; color:#374151; vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    .badge { display:inline-block; padding:2px 7px; border-radius:20px; font-size:10px; font-weight:700; }
    .on-time { background:#dcfce7; color:#16a34a; }
    .late    { background:#fee2e2; color:#dc2626; }
    .none    { background:#f1f5f9; color:#9ca3af; }
    .pts     { font-weight:700; color:#d97706; }
    a        { color:#4f46e5; }
    .footer  { margin-top:32px; border-top:1px solid #e5e7eb; padding-top:12px; font-size:11px; color:#9ca3af; }
    @media print { body { padding:20px; } .stats { page-break-inside:avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${householdName} — Activity Report</h1>
    <div class="sub">📅 ${label} &nbsp;·&nbsp; Generated ${now} &nbsp;·&nbsp; ${periodEntries.length} completions</div>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">${summary.total}</div><div class="lbl">Completions</div></div>
    <div class="stat"><div class="num">${summary.onTime + summary.late > 0 ? `${onTimeRate}%` : '—'}</div><div class="lbl">On-time rate</div></div>
    <div class="stat"><div class="num">${summary.totalPoints}</div><div class="lbl">Points earned</div></div>
    <div class="stat"><div class="num">${summary.late}</div><div class="lbl">Late completions</div></div>
  </div>

  ${memberRows ? `
  <div class="section">
    <h2>👥 Member Performance</h2>
    <table>
      <thead><tr><th>Member</th><th>Completions</th><th>On-time rate</th><th>Points</th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>
  </div>` : ''}

  ${tableRows ? `
  <div class="section">
    <h2>📋 Completion Log</h2>
    <table>
      <thead><tr><th>Chore</th><th>Member</th><th>Date</th><th>Timing</th><th>Points</th><th>Proof</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : '<p style="color:#9ca3af;text-align:center;padding:32px 0;">No completions in this period.</p>'}

  <div class="footer">ChoreSync — Household Activity Report &nbsp;·&nbsp; ${now}</div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Please allow popups to export PDF.'); return }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="space-y-6">
      {/* Period picker */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-800">Select report period</h3>
        <p className="mb-4 text-xs text-slate-400">Choose a period to export. The report will include the completion log and performance metrics.</p>
        <div className="flex gap-3">
          {(['week', 'month'] as const).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition
                ${period === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
              {p === 'week' ? '📅 This Week' : '🗓️ This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Preview card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Report preview — {label}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
          {[
            { emoji: '✅', label: 'Completions', value: String(summary.total) },
            { emoji: '🎯', label: 'On-time rate', value: summary.onTime + summary.late > 0 ? `${pct(summary.onTime, summary.onTime + summary.late)}%` : '—' },
            { emoji: '🏆', label: 'Points earned', value: String(summary.totalPoints) },
            { emoji: '👥', label: 'Active members', value: String(summary.byMember.filter(m => m.completions > 0).length) },
          ].map(({ emoji, label: l, value }) => (
            <div key={l} className="p-4 text-center">
              <p className="text-xl">{emoji}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400">{l}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">
            Will include {periodEntries.length} log entries, member performance table, and summary statistics.
          </p>
        </div>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={exportPDF}
          className="flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]">
          <span className="text-lg">📄</span>
          <div className="text-left">
            <p className="font-bold">Export as PDF</p>
            <p className="text-xs font-normal text-indigo-200">Print-ready report, opens in new tab</p>
          </div>
        </button>

        <button type="button" onClick={downloadCSV}
          className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]">
          <span className="text-lg">📊</span>
          <div className="text-left">
            <p className="font-bold">Export as CSV</p>
            <p className="text-xs font-normal text-slate-400">Import into Excel or Google Sheets</p>
          </div>
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        PDF export opens a print dialog. Select "Save as PDF" in your print settings.
      </p>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FilterPill({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition
        ${active ? (color ? 'text-white' : 'bg-slate-800 text-white') : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
      style={active && color ? { background: color } : undefined}
    >
      {color && !active && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function PhotoIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
