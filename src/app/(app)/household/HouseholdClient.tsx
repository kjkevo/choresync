'use client'

import {
  useState,
  useTransition,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  updateHouseholdName,
  regenerateInviteCode,
  removeMember,
  updateMemberRole,
  updateMemberColor,
  leaveHousehold,
} from '@/lib/actions/household'
import type { UserRow } from '@/lib/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrichedMember {
  id:           string
  user_id:      string
  role:         'admin' | 'member'
  color_theme:  string
  joined_at:    string
  user:         UserRow
}

interface Household {
  id:          string
  name:        string
  invite_code: string
  created_at:  string
}

interface Props {
  household:               Household
  members:                 EnrichedMember[]
  currentUserId:           string
  currentUserRole:         'admin' | 'member'
  currentUserMembershipId: string
}

// ── Palette shown in the colour picker ────────────────────────────────────────
const COLOR_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#84cc16', // lime
]

// ── Main component ────────────────────────────────────────────────────────────

export default function HouseholdClient({
  household: initialHousehold,
  members:   initialMembers,
  currentUserId,
  currentUserRole,
  currentUserMembershipId,
}: Props) {
  const isAdmin = currentUserRole === 'admin'

  // Local state mirrors server data so actions feel instant
  const [household,  setHousehold]  = useState(initialHousehold)
  const [members,    setMembers]    = useState(initialMembers)
  const [toast,      setToast]      = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [isPending,  startTransition] = useTransition()

  // Editing household name
  const [editingName, setEditingName] = useState(false)
  const [nameValue,   setNameValue]   = useState(household.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Invite code
  const [copied,        setCopied]        = useState(false)
  const [regenPending,  setRegenPending]  = useState(false)

  // Open member action dropdowns — one open at a time
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Colour picker open for which member id
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<null | {
    label:    string
    detail:   string
    danger:   boolean
    onConfirm: () => void
  }>(null)

  // ── Toast helper ───────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Rename household ───────────────────────────────────────────────────────
  function startEditName() {
    setNameValue(household.name)
    setEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  function cancelEditName() {
    setEditingName(false)
    setNameValue(household.name)
  }

  function saveNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  saveName()
    if (e.key === 'Escape') cancelEditName()
  }

  function saveName() {
    if (!nameValue.trim() || nameValue.trim() === household.name) {
      cancelEditName()
      return
    }
    const fd = new FormData()
    fd.append('householdId', household.id)
    fd.append('name',        nameValue.trim())

    startTransition(async () => {
      const result = await updateHouseholdName(fd)
      if (result?.error) {
        showToast(result.error, 'err')
      } else {
        setHousehold(h => ({ ...h, name: nameValue.trim() }))
        setEditingName(false)
        showToast('Household name updated.')
      }
    })
  }

  // ── Invite code ────────────────────────────────────────────────────────────
  async function copyCode() {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function doRegenCode() {
    setRegenPending(true)
    const result = await regenerateInviteCode(household.id)
    setRegenPending(false)
    if (result?.error) {
      showToast(result.error, 'err')
    } else if (result?.code) {
      setHousehold(h => ({ ...h, invite_code: result.code! }))
      showToast('Invite code regenerated.')
    }
  }

  function confirmRegenCode() {
    setConfirmAction({
      label:    'Regenerate Invite Code',
      detail:   'The old code will stop working immediately. Share the new one with anyone who still needs to join.',
      danger:   false,
      onConfirm: doRegenCode,
    })
  }

  // ── Role change ────────────────────────────────────────────────────────────
  async function changeRole(member: EnrichedMember, newRole: 'admin' | 'member') {
    setOpenMenu(null)
    const result = await updateMemberRole(member.id, household.id, newRole)
    if (result?.error) {
      showToast(result.error, 'err')
    } else {
      setMembers(ms =>
        ms.map(m => (m.id === member.id ? { ...m, role: newRole } : m))
      )
      showToast(`${memberDisplayName(member)} is now ${newRole === 'admin' ? 'an admin' : 'a member'}.`)
    }
  }

  // ── Remove member ──────────────────────────────────────────────────────────
  function confirmRemove(member: EnrichedMember) {
    setOpenMenu(null)
    setConfirmAction({
      label:  `Remove ${memberDisplayName(member)}`,
      detail: `${memberDisplayName(member)} will lose access to this household immediately.`,
      danger: true,
      onConfirm: async () => {
        const result = await removeMember(member.id, household.id)
        if (result?.error) {
          showToast(result.error, 'err')
        } else {
          setMembers(ms => ms.filter(m => m.id !== member.id))
          showToast(`${memberDisplayName(member)} removed.`)
        }
      },
    })
  }

  // ── Leave household ────────────────────────────────────────────────────────
  function confirmLeave() {
    setConfirmAction({
      label:  'Leave Household',
      detail: 'You will lose access to this household. This action cannot be undone without a new invite code.',
      danger: true,
      onConfirm: async () => {
        const result = await leaveHousehold(household.id)
        if (result?.error) showToast(result.error, 'err')
        // On success the server action redirects to /onboarding
      },
    })
  }

  // ── Colour change ──────────────────────────────────────────────────────────
  async function changeColor(memberId: string, color: string) {
    const result = await updateMemberColor(household.id, color)
    setColorPickerFor(null)
    if (result?.error) {
      showToast(result.error, 'err')
    } else {
      setMembers(ms =>
        ms.map(m => (m.id === memberId ? { ...m, color_theme: color } : m))
      )
      showToast('Colour updated.')
    }
  }

  // ── Misc helpers ───────────────────────────────────────────────────────────
  function memberDisplayName(m: EnrichedMember) {
    return m.user.full_name ?? m.user.email?.split('@')[0] ?? 'Unknown'
  }

  function initials(m: EnrichedMember) {
    const name = memberDisplayName(m)
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const closeMenuOnOutsideClick = useCallback(() => {
    setOpenMenu(null)
    setColorPickerFor(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Overlay for closing dropdowns */}
      {(openMenu || colorPickerFor) && (
        <div
          className="fixed inset-0 z-10"
          onClick={closeMenuOnOutsideClick}
          aria-hidden
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-xs animate-fade-in rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'err'
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 font-bold text-slate-900">{confirmAction.label}</h3>
            <p className="mb-6 text-sm text-slate-500">{confirmAction.detail}</p>
            <div className="flex gap-3">
              <button
                className="btn-ghost flex-1"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className={`flex-1 ${confirmAction.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  setConfirmAction(null)
                  confirmAction.onConfirm()
                }}
              >
                {confirmAction.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 pb-16 pt-10 text-white">
        <div className="mx-auto max-w-lg">
          <Link
            href="/dashboard"
            className="mb-4 flex items-center gap-1.5 text-sm font-medium text-indigo-100 hover:text-white transition-colors"
          >
            <ChevronLeftIcon /> Back to Dashboard
          </Link>

          {/* Household name — inline edit for admins */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={saveNameKey}
                    maxLength={80}
                    className="flex-1 rounded-xl bg-white/20 px-3 py-1.5 text-xl font-bold text-white
                               placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button
                    onClick={saveName}
                    disabled={isPending}
                    className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white
                               hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditName}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{household.name}</h1>
                  {isAdmin && (
                    <button
                      onClick={startEditName}
                      title="Edit household name"
                      className="rounded-lg bg-white/15 p-1.5 text-white/70
                                 hover:bg-white/25 hover:text-white transition-colors"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1 text-sm text-indigo-100">
                {members.length} member{members.length !== 1 ? 's' : ''} ·{' '}
                {isAdmin ? 'Admin view' : 'Member view'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto -mt-12 max-w-lg space-y-4 px-4 pb-24">

        {/* ── Invite code ─────────────────────────────────────────────────── */}
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Invite Code</h2>
            {isAdmin && (
              <button
                type="button"
                onClick={confirmRegenCode}
                disabled={regenPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                title="Generate a new code (old one stops working)"
              >
                <RefreshIcon spinning={regenPending} />
                Regenerate
              </button>
            )}
          </div>

          <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-6 py-5 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Share with housemates
            </p>
            <p className="font-mono text-4xl font-black tracking-[0.35em] text-indigo-600 select-all">
              {household.invite_code}
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={copyCode}
              className={`btn-ghost flex-1 text-sm ${copied ? 'border-emerald-300 text-emerald-600' : ''}`}
            >
              {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy</>}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={() =>
                  navigator.share({
                    title: `Join ${household.name} on ChoreSync`,
                    text:  `Use code ${household.invite_code} to join our household!`,
                  })
                }
                className="btn-ghost flex-1 text-sm"
              >
                <ShareIcon /> Share
              </button>
            )}
          </div>
        </section>

        {/* ── Members ─────────────────────────────────────────────────────── */}
        <section className="card">
          <h2 className="mb-4 font-semibold text-slate-900">
            Members
            <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
              {members.length}
            </span>
          </h2>

          <ul className="space-y-3">
            {members.map(member => {
              const isMe       = member.user_id === currentUserId
              const name       = memberDisplayName(member)
              const menuOpen   = openMenu === member.id
              const colorOpen  = colorPickerFor === member.id

              return (
                <li
                  key={member.id}
                  className="group relative flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      title={isMe ? 'Change your colour' : undefined}
                      onClick={isMe ? () => setColorPickerFor(colorOpen ? null : member.id) : undefined}
                      className={`h-11 w-11 overflow-hidden rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm
                        ${isMe ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 transition-shadow' : 'cursor-default'}`}
                      style={{ background: member.color_theme }}
                    >
                      {member.user.avatar_url ? (
                        <Image
                          src={member.user.avatar_url}
                          alt={name}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        initials(member)
                      )}
                    </button>

                    {/* Admin crown badge */}
                    {member.role === 'admin' && (
                      <span
                        className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] shadow-sm"
                        title="Admin"
                        aria-label="Admin"
                      >
                        👑
                      </span>
                    )}
                  </div>

                  {/* Colour picker popover */}
                  {colorOpen && (
                    <div
                      className="absolute left-0 top-14 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="mb-2.5 text-xs font-semibold text-slate-500">
                        Your household colour
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PALETTE.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => changeColor(member.id, color)}
                            aria-label={`Select colour ${color}`}
                            className="h-7 w-7 rounded-full transition hover:scale-110"
                            style={{
                              background:  color,
                              outline:     member.color_theme === color ? `3px solid ${color}` : undefined,
                              outlineOffset: '2px',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {name}
                      </span>
                      {isMe && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`text-xs font-medium ${member.role === 'admin' ? 'text-amber-600' : 'text-slate-400'}`}>
                        {member.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400">
                        Joined {formatDate(member.joined_at)}
                      </span>
                    </div>
                  </div>

                  {/* Action menu — shown for admins (on others) or for self (leave) */}
                  {(isAdmin && !isMe) || isMe ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setOpenMenu(menuOpen ? null : member.id)
                          setColorPickerFor(null)
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400
                                   hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        aria-label="Member actions"
                      >
                        <DotsIcon />
                      </button>

                      {menuOpen && (
                        <div
                          className="absolute right-0 top-9 z-20 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Admin actions on other members */}
                          {isAdmin && !isMe && (
                            <>
                              <MenuButton
                                onClick={() =>
                                  changeRole(
                                    member,
                                    member.role === 'admin' ? 'member' : 'admin'
                                  )
                                }
                              >
                                {member.role === 'admin'
                                  ? '⬇️  Demote to Member'
                                  : '⬆️  Make Admin'}
                              </MenuButton>
                              <div className="my-1 h-px bg-slate-100" />
                              <MenuButton danger onClick={() => confirmRemove(member)}>
                                🚫  Remove from Household
                              </MenuButton>
                            </>
                          )}

                          {/* Self: change colour */}
                          {isMe && (
                            <>
                              <MenuButton
                                onClick={() => {
                                  setOpenMenu(null)
                                  setColorPickerFor(member.id)
                                }}
                              >
                                🎨  Change My Colour
                              </MenuButton>
                              <div className="my-1 h-px bg-slate-100" />
                              <MenuButton danger onClick={() => { setOpenMenu(null); confirmLeave() }}>
                                🚪  Leave Household
                              </MenuButton>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Admin: danger zone ──────────────────────────────────────────── */}
        {isAdmin && (
          <section className="rounded-2xl border border-red-200 p-5">
            <h3 className="mb-1 font-semibold text-red-700">Danger Zone</h3>
            <p className="mb-4 text-sm text-slate-500">
              Deleting the household permanently removes all chores, chat messages,
              and member records. This cannot be undone.
            </p>
            <button
              type="button"
              className="text-sm font-semibold text-red-500 underline hover:text-red-700"
              onClick={() =>
                setConfirmAction({
                  label:   'Delete Household',
                  detail:  'All data — chores, messages, members — will be permanently deleted. There is no undo.',
                  danger:  true,
                  onConfirm: () => alert('Household deletion requires a dedicated API endpoint. Contact support.'),
                })
              }
            >
              Delete Household
            </button>
          </section>
        )}

        {/* ── Non-admin: leave household ──────────────────────────────────── */}
        {!isAdmin && (
          <section className="card">
            <h3 className="mb-1 font-semibold text-slate-900">Leave Household</h3>
            <p className="mb-4 text-sm text-slate-500">
              You will need a new invite code to re-join later.
            </p>
            <button
              type="button"
              onClick={confirmLeave}
              className="btn-danger text-sm"
            >
              Leave Household
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Small helper components ───────────────────────────────────────────────────

function MenuButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition hover:bg-slate-50 ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ── Tiny SVG icons ────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
