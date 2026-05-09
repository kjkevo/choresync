'use client'

import React, { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { signOut, updateProfile, uploadAvatar } from '@/lib/actions/auth'
import type { UserRow } from '@/lib/types/database'
import type { User } from '@supabase/supabase-js'

interface Membership {
  role: 'admin' | 'member'
  color_theme: string
  household: { id: string; name: string } | null
}

interface ProfileClientProps {
  user: User
  profile: UserRow | null
  membership: Membership | null
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#84cc16', '#f97316',
]

export default function ProfileClient({ user, profile, membership }: ProfileClientProps) {
  const [isPending, startTransition]         = useTransition()
  const [isSigningOut, startSignOutTransition] = useTransition()
  const [successMsg, setSuccessMsg]          = useState<string | null>(null)
  const [error, setError]                    = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview]    = useState<string | null>(null)
  const [selectedColor, setSelectedColor]    = useState(membership?.color_theme ?? '#6366f1')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? ''
  const avatarUrl   = avatarPreview ?? profile?.avatar_url ?? null
  const initials    = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be under 5 MB.')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload in background
    setUploadingAvatar(true)
    setError(null)
    const fd = new FormData()
    fd.append('avatar', file)

    const result = await uploadAvatar(fd)
    setUploadingAvatar(false)

    if (result.error) {
      setError(result.error)
      setAvatarPreview(null)
    } else if (result.avatarUrl) {
      // Persist the new URL via updateProfile
      const pfd = new FormData()
      pfd.append('fullName', displayName)
      pfd.append('avatarUrl', result.avatarUrl)
      await updateProfile(pfd)
      setSuccessMsg('Avatar updated!')
    }
  }

  // ── Color theme update ─────────────────────────────────────────────────────
  async function handleColorChange(color: string) {
    setSelectedColor(color)
    const supabase = createClient()
    const { error } = await supabase
      .from('household_members')
      .update({ color_theme: color })
      .eq('user_id', user.id)

    if (error) setError(error.message)
  }

  // ── Profile save ───────────────────────────────────────────────────────────
  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const formData = new FormData(e.currentTarget)
    if (profile?.avatar_url) formData.append('avatarUrl', profile.avatar_url)

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMsg('Profile saved!')
      }
    })
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  function handleSignOut() {
    startSignOutTransition(() => signOut())
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cs-bg)' }}>
      {/* Header */}
      <div className="hero-strip">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="mt-0.5 text-sm text-indigo-100">
            Manage your account and preferences
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-12 max-w-lg space-y-4 px-4 pb-24">
        {/* Avatar card */}
        <div className="card">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative block h-20 w-20 overflow-hidden rounded-full ring-4 ring-white shadow-md focus-visible:ring-indigo-500"
                aria-label="Change profile photo"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized={avatarUrl.startsWith('data:')}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                    style={{ background: selectedColor }}
                  >
                    {initials}
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <CameraIcon className="h-6 w-6 text-white" />
                </div>
              </button>

              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Spinner className="text-white" />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleAvatarChange}
                aria-label="Upload avatar"
              />
            </div>

            <div className="text-center sm:text-left">
              <p className="font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              {membership && (
                <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  membership.role === 'admin'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {membership.role === 'admin' ? '👑 Admin' : 'Member'}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Change photo
              </button>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {successMsg && (
          <div className="alert-success" role="status">{successMsg}</div>
        )}
        {error && (
          <div className="alert-error" role="alert">{error}</div>
        )}

        {/* Edit profile form */}
        <div className="card">
          <h2 className="mb-4 font-semibold text-slate-900">Personal Information</h2>

          <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="fullName" className="label">Full name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                defaultValue={profile?.full_name ?? ''}
                placeholder="Alex Johnson"
                className="input"
              />
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={user.email ?? ''}
                disabled
                className="input opacity-60"
              />
              <p className="mt-1 text-xs text-slate-400">
                Email changes require re-verification. Contact support to update.
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending || uploadingAvatar}
              className="btn-primary w-full"
            >
              {isPending ? <><Spinner /> Saving…</> : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Household colour picker */}
        {membership && (
          <div className="card">
            <h2 className="mb-1 font-semibold text-slate-900">Your Household Color</h2>
            <p className="mb-4 text-sm text-slate-500">
              This color identifies you in chore cards and the leaderboard.
            </p>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(color)}
                  aria-label={`Select color ${color}`}
                  className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                    selectedColor === color
                      ? 'ring-4 ring-offset-2 scale-110'
                      : ''
                  }`}
                  style={{
                    background: color,
                    ...(selectedColor === color ? { outlineColor: color } : {}),
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Household info */}
        {membership?.household && (
          <div className="card">
            <h2 className="mb-4 font-semibold" style={{ color: 'var(--cs-text)' }}>Household</h2>
            <div className="card-inset flex items-center gap-3">
              <div className="text-2xl">🏠</div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--cs-text)' }}>{membership.household.name}</p>
                <p className="text-xs" style={{ color: 'var(--cs-muted)' }}>{membership.role === 'admin' ? 'You are an admin' : 'Member'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Account actions */}
        <div className="card space-y-3">
          <h2 className="font-semibold" style={{ color: 'var(--cs-text)' }}>Account</h2>

          <a
            href="/settings"
            className="flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700"
            style={{ borderColor: 'var(--cs-border)', color: 'var(--cs-text)' }}
          >
            <SettingsIcon className="h-5 w-5" style={{ color: 'var(--cs-muted)' }} />
            App Settings
            <ChevronIcon className="ml-auto h-4 w-4" style={{ color: 'var(--cs-muted)' }} />
          </a>

          <a
            href="/forgot-password"
            className="flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700"
            style={{ borderColor: 'var(--cs-border)', color: 'var(--cs-text)' }}
          >
            <LockIcon className="h-5 w-5" style={{ color: 'var(--cs-muted)' }} />
            Change Password
            <ChevronIcon className="ml-auto h-4 w-4" style={{ color: 'var(--cs-muted)' }} />
          </a>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
          >
            {isSigningOut ? (
              <Spinner className="text-red-400" />
            ) : (
              <LogOutIcon className="h-5 w-5" />
            )}
            {isSigningOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>

        {/* Danger zone — link to Settings page */}
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 p-5">
          <h3 className="mb-1 font-semibold text-red-700 dark:text-red-400">Danger Zone</h3>
          <p className="mb-4 text-sm" style={{ color: 'var(--cs-muted)' }}>
            Leave your household or permanently delete your account in Settings.
          </p>
          <a
            href="/settings#danger"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 underline"
          >
            Go to Settings → Danger Zone
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function CameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function LogOutIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function SettingsIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
