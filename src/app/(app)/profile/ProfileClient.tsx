'use client'

import React, { useRef, useState, useTransition, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { signOut, updateProfile, uploadAvatar, updateEmail } from '@/lib/actions/auth'
import { disconnectGoogleCalendar } from '@/lib/actions/google-calendar'
import { sendInviteEmail, createHousehold, joinHousehold } from '@/lib/actions/household'
import BottomNav from '@/components/ui/BottomNav'
import CustomClient from '@/app/(app)/custom/CustomClient'
import type { UserRow } from '@/lib/types/database'
import type { User } from '@supabase/supabase-js'

// ── Constants ─────────────────────────────────────────────────────────────────

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

const EMOJI_OPTIONS = [
  '😀','😎','🤩','🥳','😺','🦊','🐼','🦄',
  '🚀','⚡','🌊','🔥','🎯','💫','🌈','🏆',
]

const COLOR_OPTIONS = [
  '#FF6B2B','#6366F1','#8B5CF6','#EC4899',
  '#EF4444','#F59E0B','#10B981','#06B6D4',
  '#3B82F6','#84CC16',
]

// Exact palette from the profile mockup
const ICON_BG: Record<string, { bg: string; fg: string }> = {
  purple: { bg: '#EEEDFE', fg: '#534AB7' },
  teal:   { bg: '#E1F5EE', fg: '#0F6E56' },
  amber:  { bg: '#FAEEDA', fg: '#854F0B' },
  coral:  { bg: '#FAECE7', fg: '#993C1D' },
  blue:   { bg: '#E6F1FB', fg: '#185FA5' },
  pink:   { bg: '#FBEAF0', fg: '#993556' },
  red:    { bg: '#FEE2E2', fg: '#B91C1C' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileStats {
  totalChores:    number
  onTimeRate:     number | null   // null when no chores have a due date
  totalPoints:    number
  householdRank:  number | null   // user's rank in household by completions
  householdSize:  number
  fairnessPercent: number | null  // user's chores / household total * 100
  badgesEarned:   number          // count of user's earned badges
}

interface Membership {
  role:        'admin' | 'member' | 'kids'
  color_theme: string
  household:   { id: string; name: string; invite_code: string } | null
}

type GcalStatus = 'connected' | 'denied' | 'error' | 'not_configured' | null

interface HouseholdSummary {
  id:         string
  name:       string
  role:       'admin' | 'member' | 'kids'
  inviteCode: string
}

interface ProfileClientProps {
  user:                    User
  profile:                 UserRow | null
  membership:              Membership | null
  householdId:             string | null
  members:                 UserRow[]
  streak:                  { current_streak: number; longest_streak: number; total_completions: number; last_active_date: string | null } | null
  stats:                   ProfileStats
  isTopEarner:             boolean
  initialUsername:         string
  initialTagline:          string
  googleCalendarConnected: boolean
  gcalStatus:              GcalStatus
  allHouseholds:           HouseholdSummary[]
  recentActivity:          Array<{
    choreId: string
    choreName: string
    choreEmoji: string
    completedAt: string
    points: number
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string = '') {
  // Use name if available; fall back to email initial; finally '?'
  if (name && name.trim()) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  if (email && email.trim()) {
    return email[0].toUpperCase()
  }
  return '?'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileClient({
  user, profile, membership, householdId, members,
  streak, stats, isTopEarner,
  initialUsername, initialTagline,
  googleCalendarConnected, gcalStatus,
  allHouseholds: initialHouseholds,
  recentActivity,
}: ProfileClientProps) {
  const router = useRouter()
  const [activeTab,       setActiveTab]      = useState<'profile' | 'chores'>('profile')
  const [editModal,       setEditModal]      = useState<null | 'name' | 'tagline' | 'username' | 'avatar' | 'appearance' | 'email'>(null)
  const [successMsg,      setSuccessMsg]     = useState<string | null>(null)
  const [errorMsg,        setErrorMsg]       = useState<string | null>(null)
  const [isPending,       startTransition]   = useTransition()
  const [isSigningOut,    startSignOut]      = useTransition()
  const [uploadingAvatar, setUploading]      = useState(false)
  const [avatarTab,       setAvatarTab]      = useState<'emoji' | 'photo' | 'color'>('emoji')

  // Profile fields — seeded from DB via props, updated optimistically on save
  const [tagline,    setTagline]    = useState(initialTagline)
  const [username,   setUsername]   = useState(initialUsername)
  // Appearance is a local-only display preference (no DB column needed)
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('system')

  // Sign out confirmation
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // Guest-mode avatar — when no real session, stored as data URL in localStorage
  // so the user can pick a photo immediately without signing up
  const [guestAvatarUrl, setGuestAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    if (user.id) return    // real user — DB is the source of truth
    try {
      const cached = localStorage.getItem('cs_guest_avatar')
      if (cached) setGuestAvatarUrl(cached)
    } catch { /* ignore */ }
  }, [user.id])

  // ── Preview onboarding hydration (sessionStorage) ─────────────────────────
  // When there's no real session/household, pull what the user entered during
  // the onboarding walkthrough so the profile reflects their choices instead
  // of showing empty placeholders.
  const [preview, setPreview] = useState<{
    householdName: string
    adminName:     string
    memberCount:   number
    choreCount:    number
    myChoreCount:  number
    inviteCode:    string | null
  } | null>(null)

  useEffect(() => {
    if (householdId) return    // real household — never override
    try {
      const raw = sessionStorage.getItem('cs_preview_onboarding')
      if (!raw) return
      const data = JSON.parse(raw) as {
        name: string
        members: { name: string; isMe?: boolean }[]
        chores: { displayAssignTo: string }[]
      }
      const me = data.members.find(m => m.isMe)
      setPreview({
        householdName: data.name ?? 'Your Household',
        adminName:     me?.name ?? '',
        memberCount:   data.members?.length ?? 0,
        choreCount:    data.chores?.length  ?? 0,
        myChoreCount:  data.chores?.filter(c => c.displayAssignTo === (me?.name ?? '')).length ?? 0,
        inviteCode:    null,   // preview households have no real invite code
      })
    } catch { /* ignore */ }
  }, [householdId])

  // Google Calendar connection state
  const [gcalConnected,      setGcalConnected]      = useState(googleCalendarConnected)
  const [gcalToast,          setGcalToast]          = useState<string | null>(null)
  const [isDisconnectingGcal, startGcalDisconnect]  = useTransition()

  const showGcalToast = useCallback((msg: string) => {
    setGcalToast(msg)
    setTimeout(() => setGcalToast(null), 4000)
  }, [])

  // Show feedback after returning from the OAuth callback
  useEffect(() => {
    if (gcalStatus === 'connected')      showGcalToast('✅ Google Calendar connected!')
    if (gcalStatus === 'denied')         showGcalToast('Google sign-in was cancelled.')
    if (gcalStatus === 'error')          showGcalToast('❌ Something went wrong. Please try again.')
    if (gcalStatus === 'not_configured') showGcalToast('⚙️ Google Calendar not yet configured — coming soon.')
  }, [gcalStatus, showGcalToast])

  function handleDisconnectGcal() {
    setGcalConnected(false)
    startGcalDisconnect(async () => {
      const r = await disconnectGoogleCalendar()
      if (r?.error) { setGcalConnected(true); showGcalToast('❌ ' + r.error) }
      else showGcalToast('Google Calendar disconnected.')
    })
  }

  // Invite by email
  const [inviteEmail,      setInviteEmail]      = useState('')
  const [inviteOpen,       setInviteOpen]        = useState(false)
  const [inviteSending,    startInviteSend]      = useTransition()
  const [inviteMsg,        setInviteMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const [linkCopied,       setLinkCopied]        = useState(false)

  function handleCopyLink() {
    const code = membership?.household?.invite_code ?? ''
    const url  = `${window.location.origin}/join/${code}`
    navigator.clipboard?.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function handleSendInvite() {
    if (!inviteEmail.trim() || !membership?.household?.id) return
    startInviteSend(async () => {
      const r = await sendInviteEmail(membership!.household!.id, inviteEmail.trim())
      if (r?.error) {
        setInviteMsg({ ok: false, text: r.error })
      } else {
        setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail.trim()}` })
        setInviteEmail('')
        setTimeout(() => { setInviteMsg(null); setInviteOpen(false) }, 3000)
      }
    })
  }

  // ── Multi-household management ─────────────────────────────────────────────
  const [households,       setHouseholds]       = useState<HouseholdSummary[]>(initialHouseholds)
  const [householdModal,   setHouseholdModal]   = useState<'create' | 'join' | null>(null)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [joinCode,         setJoinCode]         = useState('')
  const [householdPending, startHousehold]      = useTransition()
  const [householdMsg,     setHouseholdMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  function handleCreateHousehold() {
    if (!newHouseholdName.trim()) return
    const fd = new FormData()
    fd.append('name', newHouseholdName.trim())
    startHousehold(async () => {
      const r = await createHousehold(fd)
      if (r?.error) {
        setHouseholdMsg({ ok: false, text: r.error })
      } else if (r?.household) {
        const h = r.household as { id: string; name: string; invite_code: string }
        setHouseholds(prev => [...prev, { id: h.id, name: h.name, role: 'admin', inviteCode: h.invite_code }])
        setHouseholdMsg({ ok: true, text: `"${h.name}" created! Redirecting…` })
        setTimeout(() => {
          setHouseholdModal(null)
          setNewHouseholdName('')
          setHouseholdMsg(null)
          router.push(`/dashboard?h=${h.id}`)
        }, 1200)
      }
    })
  }

  function handleJoinHousehold() {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) {
      setHouseholdMsg({ ok: false, text: 'Invite codes are exactly 6 characters.' })
      return
    }
    const fd = new FormData()
    fd.append('code', code)
    startHousehold(async () => {
      const r = await joinHousehold(fd)
      if (r?.error) {
        setHouseholdMsg({ ok: false, text: r.error })
      } else if (r?.household) {
        const h = r.household as { id: string; name: string }
        // Refresh page data to get the new household's invite_code etc.
        setHouseholdMsg({ ok: true, text: `Joined "${h.name}"! Redirecting…` })
        setTimeout(() => {
          setHouseholdModal(null)
          setJoinCode('')
          setHouseholdMsg(null)
          router.push(`/dashboard?h=${h.id}`)
        }, 1200)
      }
    })
  }

  // Avatar / color
  const [selectedColor, setSelectedColor] = useState(membership?.color_theme ?? '#FF6B2B')
  const [emojiAvatar,   setEmojiAvatar]   = useState<string | null>(null)
  const [savingEmoji,   setSavingEmoji]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Draft states
  const [draftName,     setDraftName]     = useState('')
  const [draftTagline,  setDraftTagline]  = useState('')
  const [draftUsername, setDraftUsername] = useState('')
  const [draftEmail,    setDraftEmail]    = useState('')

  useEffect(() => {
    // Appearance is stored locally (cosmetic only — no server round-trip needed)
    setAppearance((localStorage.getItem('cs_appearance') as typeof appearance) ?? 'system')
    // Sync emoji avatar from profile
    const stored = profile?.avatar_url
    if (stored?.startsWith('emoji:')) setEmojiAvatar(stored.slice(6))
  }, [profile?.avatar_url])

  // Resolved display values — prefer real DB data; fall back to preview from
  // sessionStorage when there is no real session (so users can see their own
  // onboarding choices reflected back on the profile).
  const displayName   = profile?.full_name ?? user.email ?? preview?.adminName ?? 'Guest'
  // Real DB avatar takes priority; fall back to guest-mode photo from localStorage
  const rawAvatarUrl  = profile?.avatar_url ?? guestAvatarUrl ?? null
  const isEmojiAvatar = rawAvatarUrl?.startsWith('emoji:')
  const currentEmoji  = isEmojiAvatar ? rawAvatarUrl!.slice(6) : null
  const photoUrl      = !isEmojiAvatar ? rawAvatarUrl : null

  // Effective stats — fall back to preview counts when no real data
  const effectiveStats = {
    totalChores: stats.totalChores > 0 ? stats.totalChores : (preview?.myChoreCount ?? 0),
    onTimeRate:  stats.onTimeRate,
    totalPoints: stats.totalPoints,
  }

  // Streak helpers
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0
  const lastActiveDate = streak?.last_active_date ? new Date(streak.last_active_date) : null

  // Check if user completed chores today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const completedToday = lastActiveDate && lastActiveDate.getTime() >= today.getTime()
  const hasActivStreak = currentStreak > 0
  const showStreakNudge = hasActivStreak && !completedToday

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveName() {
    const name = draftName.trim()
    if (!name) return
    const fd = new FormData()
    fd.append('fullName', name)
    if (rawAvatarUrl) fd.append('avatarUrl', rawAvatarUrl)
    startTransition(async () => {
      const r = await updateProfile(fd)
      if (r?.error) setErrorMsg(r.error)
      else { setSuccessMsg('Name updated!'); setEditModal(null) }
    })
  }

  async function handleSaveTagline() {
    const t = draftTagline.trim()
    // Optimistic update
    setTagline(t)
    setEditModal(null)
    const fd = new FormData()
    fd.append('tagline', t)
    startTransition(async () => {
      const r = await updateProfile(fd)
      if (r?.error) { setErrorMsg(r.error); setTagline(initialTagline) }
      else setSuccessMsg('Tagline saved!')
    })
  }

  async function handleSaveUsername() {
    const u = draftUsername.trim().replace(/^@/, '')
    // Optimistic update
    setUsername(u)
    setEditModal(null)
    const fd = new FormData()
    fd.append('username', u)
    startTransition(async () => {
      const r = await updateProfile(fd)
      if (r?.error) { setErrorMsg(r.error); setUsername(initialUsername) }
      else setSuccessMsg('Username saved!')
    })
  }

  async function handleSaveEmail() {
    const newEmail = draftEmail.trim()
    if (!newEmail) return
    const fd = new FormData()
    fd.append('newEmail', newEmail)
    startTransition(async () => {
      const r = await updateEmail(fd)
      if (r?.error) {
        setErrorMsg(r.error)
      } else {
        setSuccessMsg(r.message || 'Verification link sent! Check your email.')
        setEditModal(null)
      }
    })
  }

  async function handleSaveEmoji() {
    if (!emojiAvatar) return
    setSavingEmoji(true)
    const fd = new FormData()
    fd.append('fullName', displayName)
    fd.append('avatarUrl', `emoji:${emojiAvatar}`)
    const r = await updateProfile(fd)
    setSavingEmoji(false)
    if (r?.error) setErrorMsg(r.error)
    else { setSuccessMsg('Avatar saved!'); setEditModal(null) }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErrorMsg('File must be under 5 MB'); return }
    setUploading(true)

    // Guest mode (no real session) — save as data URL locally so the user
    // can still see their photo. Will not persist across browsers/devices
    // until they sign up.
    const isGuest = !user.id
    if (isGuest) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        localStorage.setItem('cs_guest_avatar', dataUrl)
        setGuestAvatarUrl(dataUrl)
        // Also propagate into the preview onboarding so the dashboard
        // members section + leaderboard use it.
        try {
          const raw = sessionStorage.getItem('cs_preview_onboarding')
          if (raw) {
            const data = JSON.parse(raw) as { members?: { isMe?: boolean; avatarUrl?: string | null }[] }
            if (Array.isArray(data.members)) {
              data.members = data.members.map(m => m.isMe ? { ...m, avatarUrl: dataUrl } : m)
              sessionStorage.setItem('cs_preview_onboarding', JSON.stringify(data))
            }
          }
        } catch { /* ignore */ }
        setSuccessMsg('Photo updated!')
        setEditModal(null)
      } catch {
        setErrorMsg('Could not read that image. Try a different file.')
      } finally {
        setUploading(false)
      }
      return
    }

    // Real user — upload to Supabase Storage
    const fd = new FormData()
    fd.append('avatar', file)
    const r = await uploadAvatar(fd)
    setUploading(false)
    if (r.error) { setErrorMsg(r.error); return }
    if (r.avatarUrl) {
      const pfd = new FormData()
      pfd.append('fullName', displayName)
      pfd.append('avatarUrl', r.avatarUrl)
      await updateProfile(pfd)
      setSuccessMsg('Photo updated!')
      setEditModal(null)
      // Refresh page data to show updated avatar
      router.refresh()
    }
  }

  async function handleColorChange(color: string) {
    setSelectedColor(color)
    const supabase = createClient()
    await supabase.from('household_members').update({ color_theme: color }).eq('user_id', user.id)
    setSuccessMsg('Color updated!')
  }

  function handleSignOut() {
    setShowSignOutConfirm(true)
  }

  function confirmSignOut() {
    setShowSignOutConfirm(false)
    startSignOut(() => signOut())
  }

  function openEdit(modal: typeof editModal) {
    setSuccessMsg(null); setErrorMsg(null)
    if (modal === 'name')     setDraftName(displayName)
    if (modal === 'tagline')  setDraftTagline(tagline)
    if (modal === 'username') setDraftUsername(username ? `@${username}` : '')
    if (modal === 'email')    setDraftEmail(user.email ?? '')
    setEditModal(modal)
  }

  // ── Chore wizard tab ───────────────────────────────────────────────────────

  if (activeTab === 'chores' && householdId) {
    return (
      <>
        <style>{FONTS}</style>
        <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif', paddingBottom: 0 }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 40, background: '#fff',
            borderBottom: '1px solid #F0F0F0', padding: '0 16px', height: 52,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button
              onClick={() => setActiveTab('profile')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B2B', fontWeight: 800, fontSize: 14, fontFamily: '"Nunito", sans-serif', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            >
              ← Back
            </button>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              Add Chore
            </span>
          </div>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 0' }}>
            <CustomClient householdId={householdId} members={members} currentUserId={user.id} embedded />
          </div>
        </div>
        <BottomNav />
      </>
    )
  }

  // ── Profile tab ────────────────────────────────────────────────────────────

  return (
    <>
      <style>{FONTS}</style>
      <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif', paddingBottom: 0 }}>

        {/* ── Top bar — matches mockup ─────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, background: '#fff',
          borderBottom: '0.5px solid #E5E7EB',
          padding: '14px 16px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            My profile
          </span>
          {/* Settings shortcut */}
          <a href="/settings" style={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', textDecoration: 'none' }} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </a>
        </div>

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', padding: '20px 16px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          borderBottom: '0.5px solid #E5E7EB',
        }}>
          {/* Avatar + pencil badge */}
          <button
            onClick={() => openEdit('avatar')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 4 }}
            aria-label="Edit avatar"
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: selectedColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: currentEmoji ? 34 : 24,
              fontWeight: 500, color: '#fff',
            }}>
              {currentEmoji ? currentEmoji
                : photoUrl
                  ? <Image src={photoUrl} alt={displayName} width={72} height={72} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                  : initials(displayName, user.email ?? '')
              }
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 22, height: 22,
              borderRadius: '50%', background: '#EAF3DE', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </button>

          <button
            onClick={() => openEdit('name')}
            style={{
              fontSize: 18, fontWeight: 500, color: profile?.full_name ? '#111827' : '#9CA3AF',
              margin: 0, fontFamily: '"Poppins", sans-serif',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            {profile?.full_name ? displayName : 'Set your name →'}
          </button>

          {/* Role badge — show admin/member status */}
          {membership?.household && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
              background: membership.role === 'admin' ? '#FEF3C7' : '#E0E7FF',
              color: membership.role === 'admin' ? '#92400E' : '#312E81',
              marginTop: 6, display: 'inline-block',
            }}>
              {membership.role === 'admin' ? '👑 Admin' : '👤 Member'}
            </span>
          )}
          {preview && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
              background: '#FEF3C7', color: '#92400E',
              marginTop: 6, display: 'inline-block',
            }}>
              👑 Admin
            </span>
          )}

          {membership?.household ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {membership.household.name} · {membership.role === 'admin' ? 'Admin' : 'Member'}
            </p>
          ) : preview ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {preview.householdName} · Admin
            </p>
          ) : (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>No household yet</p>
          )}

          {/* Streak widget */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px',
            background: currentStreak > 0 ? '#FAEEDA' : '#F9FAFB',
            padding: '8px 12px', borderRadius: 10,
          }}>
            <div style={{ fontSize: 24 }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                {currentStreak > 0 ? `${currentStreak}-day streak` : 'Start your streak'}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                {longestStreak > 0 && `Best: ${longestStreak} days`}
              </div>
            </div>
            {showStreakNudge && (
              <div style={{ fontSize: 11, fontWeight: 600, color: '#633806', textAlign: 'right' }}>
                Keep it going!
              </div>
            )}
          </div>

          {/* Achievement badges */}
          {isTopEarner && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: '#EAF3DE', color: '#27500A', display: 'inline-block' }}>
              🏆 Top cleaner
            </span>
          )}
        </div>

        {/* ── Stats bar (row 1) ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #E5E7EB' }}>
          {([
            { num: effectiveStats.totalChores, label: 'Chores done', dim: false },
            { num: effectiveStats.onTimeRate !== null ? `${effectiveStats.onTimeRate}%` : '—', label: 'On-time rate', dim: effectiveStats.onTimeRate === null },
            { num: effectiveStats.totalPoints, label: 'Points', dim: false },
          ] as const).map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRight: i < 2 ? '0.5px solid #E5E7EB' : 'none' }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: s.dim ? '#D1D5DB' : '#111827', display: 'block', fontFamily: '"Poppins", sans-serif' }}>
                {s.num}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Stats bar (row 2) ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #E5E7EB' }}>
          {([
            { num: currentStreak, label: 'Current streak', dim: currentStreak === 0 },
            { num: stats.householdRank ? `#${stats.householdRank}/${stats.householdSize}` : '—', label: 'Household rank', dim: !stats.householdRank },
            { num: stats.fairnessPercent !== null ? `${stats.fairnessPercent}%` : '—', label: 'Load %', dim: stats.fairnessPercent === null },
            { num: stats.badgesEarned, label: 'Badges earned', dim: stats.badgesEarned === 0 },
          ] as const).map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRight: i < 3 ? '0.5px solid #E5E7EB' : 'none' }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: s.dim ? '#D1D5DB' : '#111827', display: 'block', fontFamily: '"Poppins", sans-serif' }}>
                {s.num}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Feedback toasts */}
        {successMsg && (
          <div style={{ margin: '10px 16px 0', background: '#D1FAE5', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#065F46' }}>
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ margin: '10px 16px 0', background: '#FEE2E2', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
            ❌ {errorMsg}
          </div>
        )}

        {/* ── My Household ──────────────────────────────────────────────────── */}
        {members.length > 0 && (
          <div style={{ margin: '16px', padding: 16, background: '#fff', borderRadius: 12, border: '0.5px solid #E5E7EB' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 12px', fontFamily: '"Poppins", sans-serif' }}>
              👥 My Household ({members.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {members.map(member => {
                const memberDisplayName = member.full_name ?? member.email?.split('@')[0] ?? 'Guest'
                const rawAvatarUrl = member.avatar_url
                const isEmojiAvatar = rawAvatarUrl?.startsWith('emoji:')
                const currentEmoji = isEmojiAvatar ? rawAvatarUrl!.slice(6) : null
                const photoUrl = !isEmojiAvatar ? rawAvatarUrl : null
                const colors = ['#FF6B2B', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4']
                const colorIndex = (member.id?.charCodeAt(0) ?? 0) % colors.length
                const selectedColor = colors[colorIndex]
                const memberPoints = (member as any).total_points ?? 0

                return (
                  <button
                    key={member.id}
                    onClick={() => router.push(`/users/${member.id}`)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: 12, borderRadius: 10, border: '1px solid #E5E7EB',
                      background: '#F9FAFB', cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderColor: '#F0F0F0', backgroundColor: '#FAFBFC',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#FF6B2B'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#FFF3EE'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', background: selectedColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', fontSize: 20, fontWeight: 500, color: '#fff',
                    }}>
                      {currentEmoji ? currentEmoji
                        : photoUrl
                          ? <Image src={photoUrl} alt={memberDisplayName} width={48} height={48} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                          : initials(member.full_name, member.email ?? '')
                      }
                    </div>
                    {/* Name */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'center', lineHeight: 1.2 }}>
                      {memberDisplayName}
                    </span>
                    {/* Points */}
                    <span style={{ fontSize: 11, color: '#FF6B2B', fontWeight: 700 }}>
                      {memberPoints} pts
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <div style={{ margin: '16px', padding: 16, background: '#fff', borderRadius: 12, border: '0.5px solid #E5E7EB' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 12px', fontFamily: '"Poppins", sans-serif' }}>
              📋 Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentActivity.map((activity, idx) => {
                const completedDate = new Date(activity.completedAt)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)

                let dateLabel: string
                if (completedDate.toDateString() === today.toDateString()) {
                  dateLabel = 'Today'
                } else if (completedDate.toDateString() === yesterday.toDateString()) {
                  dateLabel = 'Yesterday'
                } else {
                  dateLabel = completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }

                const timeLabel = completedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 10, borderRadius: 8, background: '#F9FAFB',
                      borderLeft: '3px solid #FF6B2B',
                    }}
                  >
                    {/* Emoji */}
                    <span style={{ fontSize: 20, lineHeight: 1 }}>
                      {activity.choreEmoji}
                    </span>
                    {/* Chore name + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {activity.choreName}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {dateLabel} · {timeLabel}
                      </div>
                    </div>
                    {/* Points */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B2B', whiteSpace: 'nowrap' }}>
                      +{activity.points} pts
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Identity ──────────────────────────────────────────────────────── */}
        <SectionGroup title="Identity">
          <ListRow icon="👤" color="purple" label="Display name & avatar"
            sub={`${displayName}${currentEmoji ? ` · ${currentEmoji}` : ''}`}
            onClick={() => openEdit('name')} />
          <ListRow icon="@" color="purple" label="Username"
            sub={username ? `@${username}` : 'Set a @username'}
            onClick={() => openEdit('username')} />
          <ListRow icon="😊" color="purple" label="Personal tagline"
            sub={tagline || 'Add a fun line about yourself'}
            onClick={() => openEdit('tagline')} isLast />
        </SectionGroup>

        {/* ── Stats & achievements ───────────────────────────────────────────── */}
        <SectionGroup title="Stats & achievements">
          <ListRow icon="🏅" color="amber" label="Badges & achievements"
            sub={`${effectiveStats.totalChores} earned · complete more to unlock`}
            onClick={() => {}} />
          <ListRow icon="📊" color="amber" label="My chore history"
            sub={preview && effectiveStats.totalChores === 0
              ? `${preview.choreCount} chore${preview.choreCount !== 1 ? 's' : ''} in your household`
              : 'Full log of completed tasks'}
            href="/history" />
          <ListRow icon="⚖️" color="amber" label="My fairness score"
            sub={effectiveStats.totalChores > 0
              ? `You're carrying ${effectiveStats.totalChores} of ${preview?.choreCount ?? effectiveStats.totalChores} chore${effectiveStats.totalChores !== 1 ? 's' : ''}`
              : 'Complete chores to see your score'}
            onClick={() => {}} isLast />
        </SectionGroup>

        {/* ── Preferences ───────────────────────────────────────────────────── */}
        <SectionGroup title="Preferences">
          <ListRow icon="🔔" color="teal" label="Notifications" sub="Quiet hours and alert settings" onClick={() => {}} />
          <ListRow icon="🌙" color="teal" label="Appearance"
            sub={appearance === 'system' ? 'System default' : appearance === 'dark' ? 'Dark mode' : 'Light mode'}
            onClick={() => openEdit('appearance')} />
          <ListRow icon="🌐" color="teal" label="Language & region" sub="English · US" onClick={() => {}} />
          {/* Calendar sync — real Google OAuth row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 16px',
            borderBottom: 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              background: ICON_BG.teal.bg, color: ICON_BG.teal.fg,
            }}>📅</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, color: '#111827', display: 'block', fontWeight: 400 }}>
                Calendar sync
              </span>
              <span style={{ fontSize: 12, display: 'block', marginTop: 1, color: gcalConnected ? '#10B981' : '#9CA3AF' }}>
                {gcalConnected ? 'Linked to Google Calendar' : 'Sync chores with Google Calendar'}
              </span>
            </div>
            {gcalConnected ? (
              <button
                type="button"
                onClick={handleDisconnectGcal}
                disabled={isDisconnectingGcal}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 8,
                  border: '1.5px solid #E5E7EB', background: '#fff',
                  fontSize: 12, fontWeight: 700, color: '#6B7280',
                  cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                  opacity: isDisconnectingGcal ? 0.5 : 1,
                }}
              >
                {isDisconnectingGcal ? 'Removing…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/auth/google-calendar"
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 8,
                  border: 'none', background: '#FF6B2B', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  fontFamily: '"Nunito", sans-serif', display: 'inline-block',
                }}
              >
                Connect
              </a>
            )}
          </div>
        </SectionGroup>

        {/* ── Households ────────────────────────────────────────────────────── */}
        <SectionGroup title="Households">
          {/* Prominent invite card — show when user is admin of a household */}
          {membership?.household && membership.role === 'admin' && (
            <div style={{
              margin: '0 16px 14px', padding: 16, borderRadius: 12,
              background: 'linear-gradient(135deg, #FF6B2B 0%, #FF8C47 100%)',
              border: 'none', color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 24 }}>🔗</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    Invite a roommate
                  </div>
                  <p style={{ fontSize: 12, margin: '0 0 10px', opacity: 0.95, lineHeight: 1.4 }}>
                    Share your household code or send an invite email to get everyone on ChoreSync.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleCopyLink}
                      style={{
                        padding: '8px 14px', borderRadius: 8,
                        border: 'none', background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.3)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'
                      }}
                    >
                      {linkCopied ? '✓ Link copied' : '📋 Copy link'}
                    </button>
                    <button
                      onClick={() => setInviteOpen(o => !o)}
                      style={{
                        padding: '8px 14px', borderRadius: 8,
                        border: 'none', background: '#fff',
                        color: '#FF6B2B', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '0.9'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.opacity = '1'
                      }}
                    >
                      ✉️ Send email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible email form for new prominent card */}
          {inviteOpen && membership?.household && membership.role === 'admin' && (
            <div style={{ margin: '0 16px 14px', padding: 14, background: '#FFF3EE', borderRadius: 10, border: '1.5px solid #FCDDD7' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                  placeholder="friend@example.com"
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #E5E7EB', background: '#fff',
                    fontSize: 13, color: '#111827', fontFamily: '"Nunito", sans-serif',
                  }}
                />
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail.trim() || inviteSending}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: '#FF6B2B', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: inviteEmail.trim() && !inviteSending ? 'pointer' : 'not-allowed',
                    opacity: inviteEmail.trim() && !inviteSending ? 1 : 0.5,
                    fontFamily: '"Nunito", sans-serif',
                  }}
                >
                  {inviteSending ? 'Sending…' : 'Send'}
                </button>
              </div>
              {inviteMsg && (
                <p style={{
                  fontSize: 12, margin: 0,
                  color: inviteMsg.ok ? '#10B981' : '#EF4444',
                  fontWeight: 600,
                }}>
                  {inviteMsg.ok ? '✓' : '✗'} {inviteMsg.text}
                </p>
              )}
            </div>
          )}

          {/* List every household the user belongs to */}
          {households.map((h) => (
            <a
              key={h.id}
              href={`/dashboard?h=${h.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                borderBottom: '0.5px solid #E5E7EB',
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                background: ICON_BG.blue.bg, color: ICON_BG.blue.fg,
              }}>🏠</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: '#111827', display: 'block', fontWeight: 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.name}
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginTop: 1 }}>
                  {h.role === 'admin' ? 'Admin' : 'Member'}
                  {h.id === householdId ? ' · Active' : ''}
                </span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}

          {/* Preview household card — shown when no real household exists yet */}
          {households.length === 0 && preview && (
            <a
              href="/dashboard"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                borderBottom: '0.5px solid #E5E7EB',
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                background: ICON_BG.blue.bg, color: ICON_BG.blue.fg,
              }}>🏠</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: '#111827', display: 'block', fontWeight: 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preview.householdName}
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginTop: 1 }}>
                  Admin · Active
                </span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </a>
          )}

          {/* Members row — real OR preview */}
          {membership?.household ? (
            <ListRow icon="👥" color="blue" label="Members"
              sub={`${members.length} member${members.length !== 1 ? 's' : ''} · you're ${membership.role}`}
              onClick={() => {}} />
          ) : preview ? (
            <ListRow icon="👥" color="blue" label="Members"
              sub={`${preview.memberCount} member${preview.memberCount !== 1 ? 's' : ''} · you're admin`}
              onClick={() => {}} />
          ) : null}
          {/* ── Create / Join buttons ─────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px 14px' }}>
            <button
              type="button"
              onClick={() => { setHouseholdModal('create'); setHouseholdMsg(null); setNewHouseholdName('') }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid #E5E7EB',
                background: '#fff', fontSize: 13, fontWeight: 700, color: '#374151',
                cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
              }}
            >
              + Create household
            </button>
            <button
              type="button"
              onClick={() => { setHouseholdModal('join'); setHouseholdMsg(null); setJoinCode('') }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                background: '#FF6B2B', color: '#fff',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
              }}
            >
              🔑 Join with code
            </button>
          </div>
        </SectionGroup>

        {/* ── Account & privacy ─────────────────────────────────────────────── */}
        <SectionGroup title="Account & privacy">
          <ListRow icon="🔒" color="coral" label="Change password" sub="Update your login credentials" href="/settings/change-password" />
          <ListRow icon="✉️" color="coral" label="Email address" sub={user.email ?? '—'} onClick={() => openEdit('email')} />
          <ListRow icon="🛡️" color="coral" label="Privacy & data" sub="Export or delete your data" href="/privacy" />
          <ListRow icon="🚪" color="pink" label="Sign out" labelColor="#993556"
            onClick={handleSignOut}
            right={isSigningOut ? <span style={{ fontSize: 12, color: '#9CA3AF' }}>Signing out…</span> : undefined}
            isLast noChevron />
        </SectionGroup>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {editModal === 'name' && (
        <Modal title="Edit display name" onClose={() => setEditModal(null)}>
          <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)}
            placeholder="Your name" style={INPUT_STYLE} />
          <ModalBtn label={isPending ? 'Saving…' : 'Save name'} disabled={!draftName.trim() || isPending} onClick={handleSaveName} />
        </Modal>
      )}

      {editModal === 'tagline' && (
        <Modal title="Personal tagline" onClose={() => setEditModal(null)}>
          <input autoFocus value={draftTagline} onChange={e => setDraftTagline(e.target.value)}
            placeholder="I always do the dishes first…" maxLength={80} style={INPUT_STYLE} />
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0', textAlign: 'right' }}>{draftTagline.length}/80</p>
          <ModalBtn label="Save tagline" onClick={handleSaveTagline} />
        </Modal>
      )}

      {editModal === 'username' && (
        <Modal title="Username" onClose={() => setEditModal(null)}>
          <input autoFocus value={draftUsername} onChange={e => setDraftUsername(e.target.value)}
            placeholder="@yourname" maxLength={30} style={INPUT_STYLE} />
          <ModalBtn label="Save username" onClick={handleSaveUsername} />
        </Modal>
      )}

      {editModal === 'email' && (
        <Modal title="Email address" onClose={() => setEditModal(null)}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px' }}>Current email</p>
            <p style={{ fontSize: 14, color: '#111827', fontWeight: 500, margin: 0, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              {user.email}
            </p>
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px' }}>New email address</p>
          <input autoFocus value={draftEmail} onChange={e => setDraftEmail(e.target.value)}
            placeholder="newemail@example.com" type="email" style={INPUT_STYLE} />
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
            We'll send a confirmation link to verify your new email.
          </p>
          <ModalBtn
            label={isPending ? 'Sending verification…' : 'Change email'}
            disabled={!draftEmail.trim() || draftEmail === user.email || isPending}
            onClick={handleSaveEmail}
          />
        </Modal>
      )}

      {editModal === 'appearance' && (
        <Modal title="Appearance" onClose={() => setEditModal(null)}>
          {(['system', 'light', 'dark'] as const).map(opt => (
            <button key={opt} onClick={() => { setAppearance(opt); localStorage.setItem('cs_appearance', opt); setEditModal(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6' }}>
              <span style={{ fontSize: 20 }}>{opt === 'system' ? '🖥️' : opt === 'light' ? '☀️' : '🌙'}</span>
              <span style={{ fontSize: 14, color: '#111827', fontFamily: '"Nunito", sans-serif', flex: 1, fontWeight: 600 }}>
                {opt === 'system' ? 'System default' : opt === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
              {appearance === opt && <span style={{ fontSize: 16, color: '#FF6B2B' }}>✓</span>}
            </button>
          ))}
        </Modal>
      )}

      {editModal === 'avatar' && (
        <Modal title="Edit avatar" onClose={() => setEditModal(null)}>
          {/* Tab strip */}
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 3, marginBottom: 16 }}>
            {(['emoji', 'photo', 'color'] as const).map(t => (
              <button key={t} onClick={() => setAvatarTab(t)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: avatarTab === t ? '#fff' : 'transparent',
                  fontWeight: 700, fontSize: 12, color: avatarTab === t ? '#111827' : '#9CA3AF',
                  fontFamily: '"Nunito", sans-serif',
                  boxShadow: avatarTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                {t === 'emoji' ? '😀 Emoji' : t === 'photo' ? '📷 Photo' : '🎨 Color'}
              </button>
            ))}
          </div>

          {avatarTab === 'emoji' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setEmojiAvatar(e)}
                    style={{
                      padding: '10px 0', fontSize: 26, borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${emojiAvatar === e ? '#FF6B2B' : '#E5E7EB'}`,
                      background: emojiAvatar === e ? '#FFF3EE' : '#fff',
                      boxShadow: emojiAvatar === e ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
              <ModalBtn label={savingEmoji ? 'Saving…' : 'Save emoji avatar'} disabled={!emojiAvatar || savingEmoji} onClick={handleSaveEmoji} />
            </>
          )}

          {avatarTab === 'photo' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ background: '#FF6B2B', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: '"Nunito", sans-serif' }}>
                {uploadingAvatar ? 'Uploading…' : '📷 Choose photo'}
              </button>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>JPG · PNG · WebP · max 5 MB</p>
            </div>
          )}

          {avatarTab === 'color' && (
            <>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
                This color appears on chore cards and the leaderboard.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => handleColorChange(c)}
                    style={{
                      width: 42, height: 42, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      outline: selectedColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 3,
                      transform: selectedColor === c ? 'scale(1.18)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }} />
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Create household modal ──────────────────────────────────────── */}
      {householdModal === 'create' && (
        <Modal title="Create new household" onClose={() => { setHouseholdModal(null); setHouseholdMsg(null) }}>
          <input
            autoFocus
            value={newHouseholdName}
            onChange={e => { setNewHouseholdName(e.target.value); setHouseholdMsg(null) }}
            onKeyDown={e => e.key === 'Enter' && handleCreateHousehold()}
            placeholder='e.g. "Sunset Apartment"'
            maxLength={80}
            style={INPUT_STYLE}
          />
          {householdMsg && (
            <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700,
              color: householdMsg.ok ? '#10B981' : '#EF4444' }}>
              {householdMsg.text}
            </p>
          )}
          <ModalBtn
            label={householdPending ? 'Creating…' : 'Create household'}
            disabled={!newHouseholdName.trim() || householdPending}
            onClick={handleCreateHousehold}
          />
        </Modal>
      )}

      {/* ── Join household modal ─────────────────────────────────────────── */}
      {householdModal === 'join' && (
        <Modal title="Join a household" onClose={() => { setHouseholdModal(null); setHouseholdMsg(null) }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
            Enter the 6-character invite code shared by a household member.
          </p>
          <input
            autoFocus
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setHouseholdMsg(null) }}
            onKeyDown={e => e.key === 'Enter' && handleJoinHousehold()}
            placeholder="ABC123"
            maxLength={6}
            style={{
              ...INPUT_STYLE,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              textAlign: 'center',
              fontSize: 20,
              fontWeight: 800,
              color: '#FF6B2B',
            }}
          />
          {householdMsg && (
            <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700,
              color: householdMsg.ok ? '#10B981' : '#EF4444' }}>
              {householdMsg.text}
            </p>
          )}
          <ModalBtn
            label={householdPending ? 'Joining…' : 'Join household'}
            disabled={joinCode.trim().length !== 6 || householdPending}
            onClick={handleJoinHousehold}
          />
        </Modal>
      )}

      {/* ── Sign out confirmation modal ──────────────────────────────────── */}
      {showSignOutConfirm && (
        <Modal title="Sign out?" onClose={() => setShowSignOutConfirm(false)}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 }}>
            Sign out of ChoreSync? You'll need to log back in.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowSignOutConfirm(false)}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
                background: '#F3F4F6', color: '#111827', fontWeight: 700, fontSize: 14,
                fontFamily: '"Nunito", sans-serif', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmSignOut}
              disabled={isSigningOut}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
                background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 14,
                fontFamily: '"Nunito", sans-serif', cursor: isSigningOut ? 'not-allowed' : 'pointer',
                opacity: isSigningOut ? 0.7 : 1,
              }}
            >
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </Modal>
      )}

      {/* Google Calendar OAuth toast */}
      {gcalToast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#111827', color: '#fff',
          borderRadius: 12, padding: '11px 20px',
          fontSize: 13, fontWeight: 700, fontFamily: '"Nunito", sans-serif',
          whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {gcalToast}
        </div>
      )}

      <BottomNav />
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      {/* 8px grey divider band between sections — matches the mockup */}
      <div style={{ height: 8, background: '#F2F2F7' }} />
      <div style={{ background: '#fff' }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: '#9CA3AF',
          padding: '12px 16px 6px',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {title}
        </div>
        {children}
      </div>
    </>
  )
}

function ListRow({
  icon, color, label, labelColor, sub, onClick, href, right, isLast, noChevron,
}: {
  icon:        string
  color:       keyof typeof ICON_BG
  label:       string
  labelColor?: string
  sub?:        string
  onClick?:    () => void
  href?:       string
  right?:      React.ReactNode
  isLast?:     boolean
  noChevron?:  boolean
}) {
  const borderBottom = isLast ? 'none' : '0.5px solid #E5E7EB'
  const inner = (
    <>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        background: ICON_BG[color]?.bg ?? '#F3F4F6',
        color:      ICON_BG[color]?.fg ?? '#374151',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, color: labelColor ?? '#111827', display: 'block', fontWeight: 400 }}>
          {label}
        </span>
        {sub && (
          <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </span>
        )}
      </div>
      {right ?? (!noChevron && (onClick || href) && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      ))}
    </>
  )

  const sharedStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 16px', borderBottom,
    width: '100%', textAlign: 'left',
    cursor: (onClick || href) ? 'pointer' : 'default',
  }

  if (href) return (
    <a href={href} style={{ ...sharedStyle, textDecoration: 'none' }}>{inner}</a>
  )
  return (
    <button type="button" onClick={onClick ?? (() => {})} style={{ ...sharedStyle, background: 'none', border: 'none' }}>
      {inner}
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: '50%', bottom: 0, transform: 'translateX(-50%)',
        zIndex: 70, width: '100%', maxWidth: 480,
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 44px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E7EB', margin: '0 auto 18px' }} />
        <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 17, color: '#111827', margin: '0 0 16px' }}>
          {title}
        </h2>
        {children}
      </div>
    </>
  )
}

function ModalBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        marginTop: 14, width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
        background: disabled ? '#E5E7EB' : '#FF6B2B',
        color: disabled ? '#9CA3AF' : '#fff',
        fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {label}
    </button>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1.5px solid #E5E7EB', background: '#F7F8FA',
  fontSize: 15, color: '#111827', fontFamily: '"Nunito", sans-serif',
  outline: 'none', boxSizing: 'border-box',
}
