'use client'

import React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { UserRow } from '@/lib/types/database'

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');`

interface PublicProfileClientProps {
  profile: UserRow
  totalPoints: number
  badgesEarned: number
  totalChores: number
  householdName: string | null
}

function initials(name: string | null, email: string = '') {
  if (name && name.trim()) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }
  if (email && email.trim()) {
    return email[0].toUpperCase()
  }
  return '?'
}

export default function PublicProfileClient({
  profile,
  totalPoints,
  badgesEarned,
  totalChores,
  householdName,
}: PublicProfileClientProps) {
  const router = useRouter()
  const displayName = profile.full_name ?? profile.email?.split('@')[0] ?? 'Guest'
  const rawAvatarUrl = profile.avatar_url
  const isEmojiAvatar = rawAvatarUrl?.startsWith('emoji:')
  const currentEmoji = isEmojiAvatar ? rawAvatarUrl!.slice(6) : null
  const photoUrl = !isEmojiAvatar ? rawAvatarUrl : null

  // Pick a color for the avatar
  const colors = ['#FF6B2B', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4']
  const colorIndex = (profile.id?.charCodeAt(0) ?? 0) % colors.length
  const selectedColor = colors[colorIndex]

  return (
    <>
      <style>{FONTS}</style>
      <div style={{ minHeight: '100dvh', background: '#F2F2F7', fontFamily: '"Nunito", sans-serif', paddingBottom: 40 }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, background: '#fff',
          borderBottom: '0.5px solid #E5E7EB', padding: '0 16px', height: 52,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B2B', fontWeight: 800, fontSize: 14, fontFamily: '"Nunito", sans-serif', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            aria-label="Go back"
          >
            ← Back
          </button>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 16, color: '#111827' }}>
            Profile
          </span>
        </div>

        {/* Hero section */}
        <div style={{
          background: '#fff', padding: '20px 16px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          borderBottom: '0.5px solid #E5E7EB',
        }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: selectedColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', fontSize: 34, fontWeight: 500, color: '#fff',
          }}>
            {currentEmoji ? currentEmoji
              : photoUrl
                ? <Image src={photoUrl} alt={displayName} width={72} height={72} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                : initials(profile.full_name, profile.email ?? '')
            }
          </div>

          {/* Name */}
          <p style={{ fontSize: 18, fontWeight: 500, color: '#111827', margin: 0, fontFamily: '"Poppins", sans-serif' }}>
            {displayName}
          </p>

          {/* Household */}
          {householdName && (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {householdName}
            </p>
          )}

          {/* Tagline */}
          {profile.tagline && (
            <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', fontStyle: 'italic' }}>
              "{profile.tagline}"
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #E5E7EB' }}>
          {([
            { num: totalChores, label: 'Chores done' },
            { num: totalPoints, label: 'Points' },
            { num: badgesEarned, label: 'Badges' },
          ] as const).map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRight: i < 2 ? '0.5px solid #E5E7EB' : 'none' }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: '#111827', display: 'block', fontFamily: '"Poppins", sans-serif' }}>
                {s.num}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginTop: 2 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{
          margin: '16px', padding: 14, background: '#F0F9FF', borderRadius: 12,
          border: '1px solid #BAE6FD',
        }}>
          <p style={{ fontSize: 12, color: '#0369A1', margin: 0, lineHeight: 1.5 }}>
            💙 This is {displayName}'s public profile. You can see their stats and achievements here.
          </p>
        </div>
      </div>
    </>
  )
}
