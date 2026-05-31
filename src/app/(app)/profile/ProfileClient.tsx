'use client'

import React, { useRef, useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { signOut, updateProfile, uploadAvatar } from '@/lib/actions/auth'
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

const ICON_BG: Record<string, { bg: string; fg: string }> = {
  purple: { bg: '#EEEDFE', fg: '#534AB7' },
  teal:   { bg: '#E1F5EE', fg: '#0F6E56' },
  amber:  { bg: '#FAEEDA', fg: '#854F0B' },
  coral:  { bg: '#FAECE7', fg: '#993C1D' },
  blue:   { bg: '#E6F1FB', fg: '#185FA5' },
  red:    { bg: '#FEE2E2', fg: '#B91C1C' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileStats {
  totalChores: number
  onTimeRate:  number
  totalPoints: number
}

interface Membership {
  role:        'admin' | 'member' | 'kids'
  color_theme: string
  household:   { id: string; name: string; invite_code: string } | null
}

interface ProfileClientProps {
  user:        User
  profile:     UserRow | null
  membership:  Membership | null
  householdId: string | null
  members:     UserRow[]
  streak:      { current_streak: number; total_completions: number } | null
  stats:       ProfileStats
  isTopEarner: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileClient({
  user, profile, membership, householdId, members,
  streak, stats, isTopEarner,
}: ProfileClientProps) {
  const [activeTab,       setActiveTab]      = useState<'profile' | 'chores'>('profile')
  const [editModal,       setEditModal]      = useState<null | 'name' | 'tagline' | 'username' | 'avatar' | 'appearance'>(null)
  const [successMsg,      setSuccessMsg]     = useState<string | null>(null)
  const [errorMsg,        setErrorMsg]       = useState<string | null>(null)
  const [isPending,       startTransition]   = useTransition()
  const [isSigningOut,    startSignOut]      = useTransition()
  const [uploadingAvatar, setUploading]      = useState(false)
  const [copied,          setCopied]         = useState(false)
  const [avatarTab,       setAvatarTab]      = useState<'emoji' | 'photo' | 'color'>('emoji')

  // Persisted local prefs
  const [tagline,    setTagline]    = useState('')
  const [username,   setUsername]   = useState('')
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('system')

  // Avatar / color
  const [selectedColor, setSelectedColor] = useState(membership?.color_theme ?? '#FF6B2B')
  const [emojiAvatar,   setEmojiAvatar]   = useState<string | null>(null)
  const [savingEmoji,   setSavingEmoji]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Draft states
  const [draftName,     setDraftName]     = useState('')
  const [draftTagline,  setDraftTagline]  = useState('')
  const [draftUsername, setDraftUsername] = useState('')

  useEffect(() => {
    setTagline(localStorage.getItem('cs_tagline') ?? '')
    setUsername(localStorage.getItem('cs_username') ?? '')
    setAppearance((localStorage.getItem('cs_appearance') as typeof appearance) ?? 'system')
    const stored = profile?.avatar_url
    if (stored?.startsWith('emoji:')) setEmojiAvatar(stored.slice(6))
  }, [profile?.avatar_url])

  const displayName   = profile?.full_name ?? user.email ?? ''
  const rawAvatarUrl  = profile?.avatar_url ?? null
  const isEmojiAvatar = rawAvatarUrl?.startsWith('emoji:')
  const currentEmoji  = isEmojiAvatar ? rawAvatarUrl!.slice(6) : null
  const photoUrl      = !isEmojiAvatar ? rawAvatarUrl : null

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
    localStorage.setItem('cs_tagline', t)
    setTagline(t)
    setSuccessMsg('Tagline saved!')
    setEditModal(null)
  }

  async function handleSaveUsername() {
    const u = draftUsername.trim().replace(/^@/, '')
    localStorage.setItem('cs_username', u)
    setUsername(u)
    setSuccessMsg('Username saved!')
    setEditModal(null)
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
    }
  }

  async function handleColorChange(color: string) {
    setSelectedColor(color)
    const supabase = createClient()
    await supabase.from('household_members').update({ color_theme: color }).eq('user_id', user.id)
    setSuccessMsg('Color updated!')
  }

  function handleCopyInviteCode() {
    navigator.clipboard?.writeText(membership?.household?.invite_code ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSignOut() { startSignOut(() => signOut()) }

  function openEdit(modal: typeof editModal) {
    setSuccessMsg(null); setErrorMsg(null)
    if (modal === 'name')     setDraftName(displayName)
    if (modal === 'tagline')  setDraftTagline(tagline)
    if (modal === 'username') setDraftUsername(username ? `@${username}` : '')
    setEditModal(modal)
  }

  // ── Chore wizard tab ───────────────────────────────────────────────────────

  if (activeTab === 'chores' && householdId) {
    return (
      <>
        <style>{FONTS}</style>
        <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif', paddingBottom: 88 }}>
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
      <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif', paddingBottom: 88 }}>

        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              My Profile
            </span>
            {householdId && (
              <button
                onClick={() => setActiveTab('chores')}
                style={{
                  background: '#FF6B2B', color: '#fff', border: 'none', borderRadius: 20,
                  padding: '5px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  fontFamily: '"Nunito", sans-serif', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                ✨ Add Chore
              </button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div style={{
          background: '#fff', padding: '20px 16px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          borderBottom: '0.5px solid #E5E7EB',
        }}>
          {/* Avatar with edit badge */}
          <button
            onClick={() => openEdit('avatar')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Edit avatar"
          >
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: selectedColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: currentEmoji ? 34 : 24,
              fontWeight: 700, color: '#fff',
            }}>
              {currentEmoji ? currentEmoji
                : photoUrl
                  ? <Image src={photoUrl} alt={displayName} width={72} height={72} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                  : initials(displayName)
              }
            </div>
            <div style={{
              position: 'absolute', bottom: 1, right: 1, width: 22, height: 22,
              borderRadius: '50%', background: '#EAF3DE', border: '2.5px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            }}>
              ✏️
            </div>
          </button>

          <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0, fontFamily: '"Poppins", sans-serif' }}>
            {displayName}
          </p>

          {membership?.household && (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {membership.household.name} · {membership.role === 'admin' ? '👑 Admin' : 'Member'}
            </p>
          )}

          {tagline ? (
            <button onClick={() => openEdit('tagline')} style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic', background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Nunito", sans-serif', textAlign: 'center' }}>
              "{tagline}"
            </button>
          ) : (
            <button onClick={() => openEdit('tagline')} style={{ fontSize: 13, color: '#C4C4C4', background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontFamily: '"Nunito", sans-serif' }}>
              + Add a personal tagline
            </button>
          )}

          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 }}>
            {(streak?.current_streak ?? 0) >= 2 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#FAEEDA', color: '#633806' }}>
                🔥 {streak!.current_streak}-day streak
              </span>
            )}
            {isTopEarner && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#EAF3DE', color: '#27500A' }}>
                🏆 Top earner
              </span>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #E5E7EB' }}>
          {[
            { num: stats.totalChores,      label: 'Chores done'  },
            { num: `${stats.onTimeRate}%`, label: 'On-time rate' },
            { num: stats.totalPoints,      label: 'Points'       },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRight: i < 2 ? '0.5px solid #E5E7EB' : 'none' }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#111827', display: 'block', fontFamily: '"Poppins", sans-serif' }}>
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
          <ListRow icon="🏅" color="amber" label="Badges & achievements" sub="Coming soon" onClick={() => {}} />
          <ListRow icon="📊" color="amber" label="My chore history" sub="Full log of completed tasks" href="/history" />
          <ListRow icon="⚖️" color="amber" label="My fairness score"
            sub={stats.totalChores > 0 ? `${stats.totalChores} chore${stats.totalChores !== 1 ? 's' : ''} completed` : 'No chores yet'} onClick={() => {}} />
          <ListRow icon="🎁" color="amber" label="Rewards & points"
            sub={`${stats.totalPoints} pts available`} href="/rewards" isLast />
        </SectionGroup>

        {/* ── Preferences ───────────────────────────────────────────────────── */}
        <SectionGroup title="Preferences">
          <ListRow icon="🔔" color="teal" label="Notifications" sub="Manage alerts and quiet hours" onClick={() => {}} />
          <ListRow icon="🌙" color="teal" label="Appearance"
            sub={appearance === 'system' ? 'System default' : appearance === 'dark' ? 'Dark mode' : 'Light mode'}
            onClick={() => openEdit('appearance')} />
          <ListRow icon="🌐" color="teal" label="Language & region" sub="English · US" onClick={() => {}} />
          <ListRow icon="📅" color="teal" label="Calendar sync" sub="Coming soon" onClick={() => {}} isLast />
        </SectionGroup>

        {/* ── Household ─────────────────────────────────────────────────────── */}
        {membership?.household && (
          <SectionGroup title="Household">
            <ListRow icon="🏠" color="blue" label="My household" sub={membership.household.name} href="/dashboard" />
            <ListRow icon="👥" color="blue" label="Members"
              sub={`${members.length} member${members.length !== 1 ? 's' : ''} · you're ${membership.role}`}
              onClick={() => {}} />
            <ListRow icon="🔗" color="blue" label="Invite someone"
              sub={`Code: ${membership.household.invite_code}`}
              onClick={handleCopyInviteCode}
              right={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B2B', background: '#FFF3EE', borderRadius: 8, padding: '3px 10px' }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </span>
              }
              isLast noChevron />
          </SectionGroup>
        )}

        {/* ── Account & privacy ─────────────────────────────────────────────── */}
        <SectionGroup title="Account & privacy">
          <ListRow icon="🔒" color="coral" label="Change password" sub="Update your login credentials" href="/forgot-password" />
          <ListRow icon="✉️" color="coral" label="Email address" sub={user.email ?? '—'} onClick={() => {}} noChevron />
          <ListRow icon="🛡️" color="coral" label="Privacy & data" sub="Export or delete your account" href="/privacy" />
          <ListRow icon="🚪" color="red" label="Sign out" labelColor="#B91C1C"
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

      <BottomNav />
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '10px 16px 5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ background: '#fff' }}>{children}</div>
    </div>
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
  const borderBottom = isLast ? 'none' : '0.5px solid #F3F4F6'
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
        <span style={{ fontSize: 14, color: labelColor ?? '#111827', display: 'block', fontWeight: 600 }}>
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
    padding: '12px 16px', borderBottom,
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
