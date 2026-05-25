'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '@/lib/contexts/ThemeContext'
import {
  updateHouseholdSettings,
  addCustomCategory,
  removeCustomCategory,
  deleteAccount,
} from '@/lib/actions/settings'
import { updateHouseholdName, leaveHousehold } from '@/lib/actions/household'
import type { HouseholdSettings, UserRow } from '@/lib/types/database'
import { usePushSubscription } from '@/lib/hooks/usePushSubscription'

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home'     },
  { href: '/chores',    label: 'Chores'   },
  { href: '/calendar',  label: '📅'       },
  { href: '/social',    label: '💬'       },
  { href: '/history',   label: '📊'       },
  { href: '/rewards',   label: '🏆'       },
  { href: '/household', label: 'House'    },
  { href: '/settings',  label: '⚙️', active: true },
  { href: '/profile',   label: 'Profile'  },
]

// ── Built-in categories ───────────────────────────────────────────────────────

const BUILT_IN_CATEGORIES = [
  { value: 'kitchen',  label: 'Kitchen',  emoji: '🍳' },
  { value: 'bathroom', label: 'Bathroom', emoji: '🚿' },
  { value: 'bedroom',  label: 'Bedroom',  emoji: '🛏️' },
  { value: 'outdoor',  label: 'Outdoor',  emoji: '🌿' },
  { value: 'laundry',  label: 'Laundry',  emoji: '👕' },
  { value: 'general',  label: 'General',  emoji: '🏠' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  householdId:       string
  householdName:     string
  householdSettings: HouseholdSettings
  currentUserId:     string   // available for future per-user features
  currentUserRole:   'admin' | 'member'
  profile:           UserRow | null  // available for future display
}

// ── Section ids ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'household',    label: '🏠 Household',     adminOnly: true  },
  { id: 'appearance',   label: '🎨 Appearance',    adminOnly: false },
  { id: 'notifications',label: '🔔 Notifications', adminOnly: false },
  { id: 'danger',       label: '⚠️ Danger Zone',   adminOnly: false },
] as const

type SectionId = typeof SECTIONS[number]['id']

// ── Notification prefs (server-persisted) ─────────────────────────────────────

interface DbNotifPrefs {
  notify_due:      boolean
  notify_overdue:  boolean
  notify_assigned: boolean
  notify_nudge:    boolean
  quiet_start:     string | null
  quiet_end:       string | null
}
const DEFAULT_DB_NOTIF_PREFS: DbNotifPrefs = {
  notify_due:      true,
  notify_overdue:  true,
  notify_assigned: true,
  notify_nudge:    true,
  quiet_start:     null,
  quiet_end:       null,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsClient({
  householdId,
  householdName,
  householdSettings,
  currentUserRole,
}: Props) {
  const isAdmin = currentUserRole === 'admin'
  const { theme, isDark, setTheme } = useTheme()

  // ── Section scroll spy ────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionId>('appearance')
  function scrollTo(id: SectionId) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  // ── Household name ────────────────────────────────────────────────────────
  const [hhName, setHhName]                = useState(householdName)
  const [hhNamePending, startHhName]       = useTransition()
  const [hhNameMsg, setHhNameMsg]          = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleRenameHousehold(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('householdId', householdId)
    fd.append('name', hhName)
    startHhName(async () => {
      const res = await updateHouseholdName(fd)
      setHhNameMsg(res.error
        ? { type: 'err', text: res.error }
        : { type: 'ok', text: 'Household name saved!' })
      setTimeout(() => setHhNameMsg(null), 3000)
    })
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const [customCats, setCustomCats]        = useState<string[]>(householdSettings.customCategories ?? [])
  const [newCatInput, setNewCatInput]      = useState('')
  const [catPending, startCat]             = useTransition()
  const [catMsg, setCatMsg]                = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    startCat(async () => {
      const res = await addCustomCategory(householdId, newCatInput)
      if (res.error) {
        setCatMsg({ type: 'err', text: res.error })
      } else {
        const slug = newCatInput.trim().toLowerCase().replace(/\s+/g, '-')
        setCustomCats(prev => [...prev, slug])
        setNewCatInput('')
        setCatMsg({ type: 'ok', text: 'Category added!' })
      }
      setTimeout(() => setCatMsg(null), 3000)
    })
  }

  function handleRemoveCategory(name: string) {
    startCat(async () => {
      const res = await removeCustomCategory(householdId, name)
      if (!res.error) {
        setCustomCats(prev => prev.filter(c => c !== name))
      } else {
        setCatMsg({ type: 'err', text: res.error })
        setTimeout(() => setCatMsg(null), 3000)
      }
    })
  }

  // ── Point values ──────────────────────────────────────────────────────────
  const defaultPV = { low: 5, medium: 10, high: 20 }
  const [pointValues, setPointValues] = useState({
    low:    householdSettings.pointValues?.low    ?? defaultPV.low,
    medium: householdSettings.pointValues?.medium ?? defaultPV.medium,
    high:   householdSettings.pointValues?.high   ?? defaultPV.high,
  })
  const [pvPending, startPv]       = useTransition()
  const [pvMsg, setPvMsg]          = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleSavePointValues(e: React.FormEvent) {
    e.preventDefault()
    startPv(async () => {
      const res = await updateHouseholdSettings(householdId, { pointValues })
      setPvMsg(res.error
        ? { type: 'err', text: res.error }
        : { type: 'ok', text: 'Point values saved!' })
      setTimeout(() => setPvMsg(null), 3000)
    })
  }

  // ── Reset day ─────────────────────────────────────────────────────────────
  const [resetDay, setResetDay]    = useState<'sunday' | 'monday'>(
    householdSettings.resetDay ?? 'monday'
  )
  const [rdPending, startRd]       = useTransition()
  const [rdMsg, setRdMsg]          = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleResetDay(day: 'sunday' | 'monday') {
    setResetDay(day)
    startRd(async () => {
      const res = await updateHouseholdSettings(householdId, { resetDay: day })
      setRdMsg(res.error
        ? { type: 'err', text: res.error }
        : { type: 'ok', text: `Reset day set to ${day.charAt(0).toUpperCase() + day.slice(1)}!` })
      setTimeout(() => setRdMsg(null), 3000)
    })
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const { status: pushStatus, loading: pushLoading, subscribe, unsubscribe } = usePushSubscription(householdId)

  const [dbPrefs, setDbPrefs]           = useState<DbNotifPrefs>(DEFAULT_DB_NOTIF_PREFS)
  const [prefsLoaded, setPrefsLoaded]   = useState(false)
  const [prefsSaving, setPrefsSaving]   = useState(false)
  const [prefsMsg, setPrefsMsg]         = useState<{ type: 'ok'|'err'; text: string } | null>(null)
  const [pushMsg, setPushMsg]           = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  // Load prefs from server on mount
  useEffect(() => {
    if (!householdId) return
    fetch(`/api/push/prefs?householdId=${householdId}`)
      .then(r => r.json())
      .then(({ prefs }) => {
        if (prefs) setDbPrefs({ ...DEFAULT_DB_NOTIF_PREFS, ...prefs })
        setPrefsLoaded(true)
      })
      .catch(() => setPrefsLoaded(true))
  }, [householdId])

  const savePrefs = useCallback(async (next: DbNotifPrefs) => {
    setPrefsSaving(true)
    setPrefsMsg(null)
    try {
      const res = await fetch('/api/push/prefs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ householdId, ...next }),
      })
      if (res.ok) {
        setPrefsMsg({ type: 'ok', text: 'Preferences saved!' })
      } else {
        const { error } = await res.json()
        setPrefsMsg({ type: 'err', text: error ?? 'Save failed' })
      }
    } catch {
      setPrefsMsg({ type: 'err', text: 'Network error' })
    } finally {
      setPrefsSaving(false)
      setTimeout(() => setPrefsMsg(null), 3000)
    }
  }, [householdId])

  function toggleDbPref(key: keyof Pick<DbNotifPrefs, 'notify_due'|'notify_overdue'|'notify_assigned'|'notify_nudge'>) {
    const next = { ...dbPrefs, [key]: !dbPrefs[key] }
    setDbPrefs(next)
    savePrefs(next)
  }

  async function handlePushToggle() {
    if (pushStatus === 'subscribed') {
      const { error } = await unsubscribe()
      if (error) setPushMsg({ type: 'err', text: error })
      else setPushMsg({ type: 'ok', text: 'Push notifications disabled.' })
    } else {
      const { error } = await subscribe()
      if (error) setPushMsg({ type: 'err', text: error })
      else setPushMsg({ type: 'ok', text: 'Push notifications enabled!' })
    }
    setTimeout(() => setPushMsg(null), 4000)
  }

  function handleQuietChange(field: 'quiet_start' | 'quiet_end', value: string) {
    const next = { ...dbPrefs, [field]: value || null }
    setDbPrefs(next)
  }

  function handleQuietBlur() {
    savePrefs(dbPrefs)
  }

  // ── Leave household modal ──────────────────────────────────────────────────
  const [showLeave, setShowLeave]    = useState(false)
  const [leavePending, startLeave]   = useTransition()
  const [leaveError, setLeaveError]  = useState<string | null>(null)

  function handleLeave() {
    startLeave(async () => {
      const res = await leaveHousehold(householdId)
      if (res?.error) {
        setLeaveError(res.error)
        setShowLeave(false)
      }
    })
  }

  // ── Delete account modal ──────────────────────────────────────────────────
  const [showDelete, setShowDelete]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePending, startDelete]    = useTransition()
  const DELETE_PHRASE = 'delete my account'

  function handleDeleteAccount() {
    if (deleteConfirm.toLowerCase() !== DELETE_PHRASE) return
    startDelete(async () => { await deleteAccount() })
  }

  // ── Sidebar refs ──────────────────────────────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const handler = () => {
      const sections = SECTIONS.map(s => ({
        id: s.id,
        top: document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity,
      }))
      const visible = sections.filter(s => s.top < 200)
      if (visible.length) setActiveSection(visible[visible.length - 1].id as SectionId)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // ── Rendered sections ─────────────────────────────────────────────────────
  const visibleSections = SECTIONS.filter(s => !s.adminOnly || isAdmin)

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)', color: 'var(--cs-text)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--cs-muted)' }}>Settings</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, active }) => (
              <a key={href} href={href}
                className={`nav-link${active ? ' active' : ''}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="hero-strip">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="mt-0.5 text-sm text-indigo-100">Customise your household and preferences</p>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 pb-24">
        <div className="flex gap-8 -mt-8">

          {/* ── Sidebar nav (desktop) ────────────────────────────────────── */}
          <aside className="hidden md:block w-52 flex-shrink-0 pt-4">
            <div className="card sticky top-24 p-3">
              <nav className="space-y-0.5">
                {visibleSections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all ${
                      activeSection === s.id
                        ? 'bg-indigo-600 text-white'
                        : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <main ref={mainRef} className="flex-1 min-w-0 space-y-6 pt-4 animate-in">

            {/* ── Global error banner ──────────────────────────────────── */}
            {leaveError && (
              <div className="alert-error">{leaveError}</div>
            )}

            {/* ════════════════════════════════════════════════════════════
                SECTION: Household (admin only)
            ════════════════════════════════════════════════════════════ */}
            {isAdmin && (
              <section id="household" className="scroll-mt-24 space-y-4">
                <h2 className="section-title">🏠 Household</h2>

                {/* Rename household */}
                <div className="card space-y-4">
                  <div>
                    <h3 className="font-semibold">Household Name</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      This name appears across the app for all members.
                    </p>
                  </div>
                  <form onSubmit={handleRenameHousehold} className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={hhName}
                      onChange={e => setHhName(e.target.value)}
                      placeholder="e.g. The Johnson House"
                      maxLength={80}
                      required
                    />
                    <button type="submit" disabled={hhNamePending || hhName === householdName}
                      className="btn-primary flex-shrink-0">
                      {hhNamePending ? <Spinner /> : 'Save'}
                    </button>
                  </form>
                  {hhNameMsg && (
                    <p className={`text-sm font-medium ${hhNameMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {hhNameMsg.text}
                    </p>
                  )}
                </div>

                {/* Category management */}
                <div className="card space-y-4">
                  <div>
                    <h3 className="font-semibold">Chore Categories</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      Built-in categories are always available. Add custom ones for your household.
                    </p>
                  </div>

                  {/* Built-in */}
                  <div>
                    <p className="label mb-2">Built-in</p>
                    <div className="flex flex-wrap gap-2">
                      {BUILT_IN_CATEGORIES.map(c => (
                        <span key={c.value}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ background: 'var(--cs-inset)', color: 'var(--cs-muted)' }}>
                          <span>{c.emoji}</span> {c.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Custom */}
                  <div>
                    <p className="label mb-2">Custom ({customCats.length}/10)</p>
                    {customCats.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {customCats.map(c => (
                          <span key={c}
                            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            <span>🏷️</span>
                            {c.replace(/-/g, ' ')}
                            <button
                              type="button"
                              onClick={() => handleRemoveCategory(c)}
                              disabled={catPending}
                              className="ml-1 rounded-full hover:text-red-600 transition-colors"
                              aria-label={`Remove ${c}`}
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-sm" style={{ color: 'var(--cs-muted)' }}>No custom categories yet.</p>
                    )}

                    <form onSubmit={handleAddCategory} className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        value={newCatInput}
                        onChange={e => setNewCatInput(e.target.value)}
                        placeholder="e.g. garage, pet-care"
                        maxLength={30}
                        disabled={catPending || customCats.length >= 10}
                      />
                      <button type="submit"
                        disabled={catPending || !newCatInput.trim() || customCats.length >= 10}
                        className="btn-primary flex-shrink-0 text-sm">
                        {catPending ? <Spinner /> : '+ Add'}
                      </button>
                    </form>
                    {catMsg && (
                      <p className={`mt-1.5 text-sm font-medium ${catMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {catMsg.text}
                      </p>
                    )}
                  </div>
                </div>

                {/* Point values */}
                <div className="card space-y-4">
                  <div>
                    <h3 className="font-semibold">Default Point Values</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      These are the suggested points auto-filled when creating new chores.
                    </p>
                  </div>
                  <form onSubmit={handleSavePointValues} className="space-y-3">
                    {(['low', 'medium', 'high'] as const).map(priority => (
                      <div key={priority} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            priority === 'low'    ? 'bg-emerald-500' :
                            priority === 'medium' ? 'bg-amber-400' : 'bg-red-500'
                          }`} />
                          <span className="text-sm font-medium capitalize">{priority} priority</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0} max={100}
                            className="input w-20 py-1.5 text-center text-sm"
                            value={pointValues[priority]}
                            onChange={e => setPointValues(prev => ({
                              ...prev,
                              [priority]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                            }))}
                          />
                          <span className="text-sm" style={{ color: 'var(--cs-muted)' }}>pts</span>
                        </div>
                      </div>
                    ))}
                    <button type="submit" disabled={pvPending} className="btn-primary w-full mt-2">
                      {pvPending ? <><Spinner /> Saving…</> : 'Save Point Values'}
                    </button>
                    {pvMsg && (
                      <p className={`text-sm font-medium text-center ${pvMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pvMsg.text}
                      </p>
                    )}
                  </form>
                </div>

                {/* Leaderboard reset day */}
                <div className="card space-y-4">
                  <div>
                    <h3 className="font-semibold">Leaderboard Reset Day</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      Weekly leaderboard points reset at midnight on this day.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['monday', 'sunday'] as const).map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleResetDay(day)}
                        disabled={rdPending}
                        className={`rounded-xl border-2 py-4 text-sm font-semibold transition-all ${
                          resetDay === day
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                            : 'border-transparent hover:border-slate-300'
                        }`}
                        style={resetDay !== day ? { background: 'var(--cs-inset)', color: 'var(--cs-muted)' } : {}}
                      >
                        <span className="block text-xl mb-1">{day === 'monday' ? '🔵' : '🔴'}</span>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </button>
                    ))}
                  </div>
                  {rdMsg && (
                    <p className={`text-sm font-medium ${rdMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {rdMsg.text}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════
                SECTION: Appearance
            ════════════════════════════════════════════════════════════ */}
            <section id="appearance" className="scroll-mt-24 space-y-4">
              <h2 className="section-title">🎨 Appearance</h2>

              <div className="card space-y-5">
                <div>
                  <h3 className="font-semibold">Theme</h3>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                    Choose your preferred color scheme.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'light',  label: 'Light',  icon: '☀️' },
                    { key: 'dark',   label: 'Dark',   icon: '🌙' },
                    { key: 'system', label: 'System', icon: '💻' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTheme(opt.key)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-semibold transition-all ${
                        theme === opt.key
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      style={theme !== opt.key ? { background: 'var(--cs-inset)', color: 'var(--cs-muted)' } : {}}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Live preview strip */}
                <div className="rounded-xl overflow-hidden" style={{ outline: '1px solid var(--cs-border)' }}>
                  <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--cs-inset)', color: 'var(--cs-muted)' }}>
                    Preview
                  </div>
                  <div className="flex items-center gap-3 p-4" style={{ background: 'var(--cs-surface)' }}>
                    <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                      AJ
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>Alex Johnson</p>
                      <p className="text-xs" style={{ color: 'var(--cs-muted)' }}>
                        {isDark ? '🌙 Dark mode is on' : '☀️ Light mode is on'}
                      </p>
                    </div>
                    <span className="ml-auto rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      Admin
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                SECTION: Notifications
            ════════════════════════════════════════════════════════════ */}
            <section id="notifications" className="scroll-mt-24 space-y-4">
              <h2 className="section-title">🔔 Notifications</h2>

              {/* ── Push enable / disable card ─────────────────────── */}
              <div className="card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Push Notifications</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      {pushStatus === 'unsupported'
                        ? 'Your browser does not support push notifications.'
                        : pushStatus === 'denied'
                        ? 'Notifications are blocked. Enable them in your browser settings.'
                        : pushStatus === 'subscribed'
                        ? 'You are receiving push notifications on this device.'
                        : 'Enable push notifications to get chore reminders and nudges.'}
                    </p>
                  </div>
                  {pushStatus !== 'unsupported' && pushStatus !== 'denied' && (
                    <button
                      type="button"
                      onClick={handlePushToggle}
                      disabled={pushLoading}
                      className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        pushStatus === 'subscribed'
                          ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {pushLoading ? <Spinner /> : pushStatus === 'subscribed' ? 'Turn off' : 'Enable'}
                    </button>
                  )}
                </div>

                {pushMsg && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    pushMsg.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {pushMsg.text}
                  </div>
                )}

                {pushStatus === 'denied' && (
                  <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    To re-enable notifications, click the lock icon in your browser's address bar and set Notifications to &quot;Allow&quot;.
                  </div>
                )}
              </div>

              {/* ── Per-type preferences ───────────────────────────── */}
              <div className="card space-y-5">
                <div>
                  <h3 className="font-semibold">Alert Types</h3>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                    Choose which events trigger a push notification.
                  </p>
                </div>

                {!prefsLoaded ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : (
                  <div className="space-y-3">
                    {([
                      { key: 'notify_due'      as const, label: 'Due today',        description: 'Notified when your chore is due today.' },
                      { key: 'notify_overdue'  as const, label: 'Overdue alert',    description: 'Notified when a chore passes its due date.' },
                      { key: 'notify_assigned' as const, label: 'Newly assigned',   description: 'Notified when a chore is assigned to you.' },
                      { key: 'notify_nudge'    as const, label: 'Roommate nudges',  description: 'Receive friendly pings from your housemates.' },
                    ]).map(row => (
                      <div key={row.key} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                        style={{ background: 'var(--cs-inset)', border: '1px solid var(--cs-border)' }}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>{row.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--cs-muted)' }}>{row.description}</p>
                        </div>
                        <Toggle
                          checked={dbPrefs[row.key]}
                          onChange={() => toggleDbPref(row.key)}
                          label=""
                        />
                      </div>
                    ))}
                  </div>
                )}

                {prefsMsg && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    prefsMsg.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {prefsSaving ? 'Saving…' : prefsMsg.text}
                  </div>
                )}
              </div>

              {/* ── Quiet hours ────────────────────────────────────── */}
              <div className="card space-y-4">
                <div>
                  <h3 className="font-semibold">🌙 Quiet Hours</h3>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                    Silence all notifications during these hours (your local time zone is used in UTC — adjust accordingly).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cs-muted)' }}>
                      Start time
                    </label>
                    <input
                      type="time"
                      value={dbPrefs.quiet_start ?? ''}
                      onChange={e => handleQuietChange('quiet_start', e.target.value)}
                      onBlur={handleQuietBlur}
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      style={{ background: 'var(--cs-inset)', borderColor: 'var(--cs-border)', color: 'var(--cs-text)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cs-muted)' }}>
                      End time
                    </label>
                    <input
                      type="time"
                      value={dbPrefs.quiet_end ?? ''}
                      onChange={e => handleQuietChange('quiet_end', e.target.value)}
                      onBlur={handleQuietBlur}
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      style={{ background: 'var(--cs-inset)', borderColor: 'var(--cs-border)', color: 'var(--cs-text)' }}
                    />
                  </div>
                </div>

                {dbPrefs.quiet_start && dbPrefs.quiet_end && (
                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-400">
                    Quiet from <strong>{dbPrefs.quiet_start}</strong> to <strong>{dbPrefs.quiet_end}</strong>
                    {' '}— notifications will be silenced during this window.
                  </div>
                )}

                {(dbPrefs.quiet_start || dbPrefs.quiet_end) && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...dbPrefs, quiet_start: null, quiet_end: null }
                      setDbPrefs(next)
                      savePrefs(next)
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear quiet hours
                  </button>
                )}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                SECTION: Danger Zone
            ════════════════════════════════════════════════════════════ */}
            <section id="danger" className="scroll-mt-24 space-y-4">
              <h2 className="section-title">⚠️ Danger Zone</h2>

              <div className="rounded-2xl border-2 border-red-200 dark:border-red-900/60 p-6 space-y-5">

                {/* Leave household */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">Leave Household</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      You will lose access to all shared chores, history, and messages.
                      {isAdmin && ' As the admin, ensure another member is promoted first.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLeaveError(null); setShowLeave(true) }}
                    disabled={leavePending}
                    className="flex-shrink-0 btn-danger"
                  >
                    {leavePending ? <Spinner /> : 'Leave'}
                  </button>
                </div>

                <hr style={{ borderColor: 'var(--cs-border)' }} />

                {/* Delete account */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-700 dark:text-red-400">Delete Account</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--cs-muted)' }}>
                      Permanently delete your account and all your data. This cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDeleteConfirm(''); setShowDelete(true) }}
                    disabled={deletePending}
                    className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {deletePending ? <Spinner /> : 'Delete Account'}
                  </button>
                </div>
              </div>
            </section>

          </main>
        </div>
      </div>

      {/* ── Leave modal ───────────────────────────────────────────────────── */}
      {showLeave && (
        <Modal onClose={() => setShowLeave(false)}>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-3xl">
              🚪
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--cs-text)' }}>Leave Household?</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--cs-muted)' }}>
                You will lose access to all shared chores, history, and messages.
                You can rejoin using the household invite code.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={leavePending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 transition"
              >
                {leavePending ? <Spinner /> : 'Yes, Leave'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete account modal ──────────────────────────────────────────── */}
      {showDelete && (
        <Modal onClose={() => setShowDelete(false)}>
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 text-3xl">
                🗑️
              </div>
              <h3 className="mt-3 text-lg font-bold text-red-700 dark:text-red-400">Delete Account</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--cs-muted)' }}>
                This will permanently remove your profile, points, badges, and history.
                <strong className="text-red-600"> This cannot be undone.</strong>
              </p>
            </div>

            <div>
              <label className="label text-red-600">
                Type <span className="font-mono normal-case">&quot;{DELETE_PHRASE}&quot;</span> to confirm
              </label>
              <input
                className="input border-red-300 focus:border-red-500 focus:ring-red-500/20"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={DELETE_PHRASE}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletePending || deleteConfirm.toLowerCase() !== DELETE_PHRASE}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {deletePending ? <Spinner /> : 'Delete Forever'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Toggle sub-component ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`toggle ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span
          className={`toggle-thumb ${checked ? 'translate-x-5' : 'translate-x-0'}`}
          aria-hidden
        />
      </button>
      <span className="text-sm font-medium" style={{ color: 'var(--cs-text)' }}>{label}</span>
    </label>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in" onClick={onClose} />
      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in-up"
        style={{ background: 'var(--cs-surface)', color: 'var(--cs-text)' }}
        role="dialog" aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
