'use client'

import Image from 'next/image'
import BottomNav from '@/components/ui/BottomNav'

export interface LeaderboardEntry {
  userId:      string
  name:        string
  avatarUrl:   string | null
  color:       string
  points:      number
  completions: number
}

interface LeaderboardClientProps {
  leaderboard:   LeaderboardEntry[]
  currentUserId: string
}

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
`

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: number }) {
  if (entry.avatarUrl && !entry.avatarUrl.startsWith('emoji:')) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: entry.color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Image
          src={entry.avatarUrl}
          alt={entry.name}
          width={size} height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          unoptimized
        />
      </div>
    )
  }
  if (entry.avatarUrl?.startsWith('emoji:')) {
    const emoji = entry.avatarUrl.slice(6)
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: entry.color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42,
      }}>
        {emoji}
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: entry.color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: '#fff',
    }}>
      {initials(entry.name)}
    </div>
  )
}

export default function LeaderboardClient({ leaderboard, currentUserId }: LeaderboardClientProps) {
  const top3   = leaderboard.slice(0, 3)
  const rest   = leaderboard.slice(3)
  const first  = top3[0]
  const second = top3[1]
  const third  = top3[2]

  return (
    <>
      <style>{FONTS}</style>
      <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: '"Nunito", sans-serif', paddingBottom: 80 }}>

        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#fff', borderBottom: '1px solid #F0F0F0',
          padding: '0 20px', height: 58,
          display: 'flex', alignItems: 'center',
        }}>
          <span style={{
            fontFamily: '"Poppins", sans-serif', fontWeight: 800,
            fontSize: 20, color: '#111827', letterSpacing: '-0.3px',
          }}>
            🏆 Leaderboard
          </span>
        </header>

        <main style={{ maxWidth: 500, margin: '0 auto', padding: '20px 16px 0' }}>

          {leaderboard.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: 20, border: '1px solid #F0F0F0',
              padding: '48px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
              <p style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                fontSize: 16, color: '#374151', margin: '0 0 8px',
              }}>
                No completions yet
              </p>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
                Start completing chores to earn points!
              </p>
            </div>
          ) : (
            <>
              {/* Podium */}
              {top3.length >= 2 && (
                <div style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  borderRadius: 24, padding: '28px 16px 32px',
                  marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>

                    {/* 2nd place */}
                    {second && (
                      <PodiumSlot
                        entry={second}
                        medal="🥈"
                        rank={2}
                        size={64}
                        pedestalHeight={64}
                        isMe={second.userId === currentUserId}
                      />
                    )}

                    {/* 1st place (center, larger) */}
                    {first && (
                      <PodiumSlot
                        entry={first}
                        medal="🥇"
                        rank={1}
                        size={80}
                        pedestalHeight={90}
                        isMe={first.userId === currentUserId}
                      />
                    )}

                    {/* 3rd place */}
                    {third && (
                      <PodiumSlot
                        entry={third}
                        medal="🥉"
                        rank={3}
                        size={64}
                        pedestalHeight={48}
                        isMe={third.userId === currentUserId}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Ranked list for 4+ */}
              {rest.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                  {rest.map((entry, i) => {
                    const rank  = i + 4
                    const isMe  = entry.userId === currentUserId
                    return (
                      <div
                        key={entry.userId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px',
                          borderBottom: i < rest.length - 1 ? '1px solid #F7F8FA' : 'none',
                          borderLeft: isMe ? '4px solid #FF6B2B' : '4px solid transparent',
                          background: isMe ? '#FFF9F7' : '#fff',
                        }}
                      >
                        <span style={{
                          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                          fontSize: 16, color: '#9CA3AF', width: 24, textAlign: 'center', flexShrink: 0,
                        }}>
                          {rank}
                        </span>
                        <Avatar entry={entry} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                            fontSize: 14, color: isMe ? '#FF6B2B' : '#111827',
                            margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {entry.name}{isMe ? ' (you)' : ''}
                          </p>
                          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
                            {entry.completions} chore{entry.completions !== 1 ? 's' : ''} completed
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{
                            fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                            fontSize: 18, color: '#FF6B2B', margin: 0,
                          }}>
                            {entry.points}
                          </p>
                          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>pts</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* If only 1 person, show them in a simple list too */}
              {top3.length === 1 && (
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    borderLeft: first.userId === currentUserId ? '4px solid #FF6B2B' : '4px solid transparent',
                    background: first.userId === currentUserId ? '#FFF9F7' : '#fff',
                  }}>
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 20 }}>🥇</span>
                    <Avatar entry={first} size={40} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>
                        {first.name}
                      </p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
                        {first.completions} chore{first.completions !== 1 ? 's' : ''} completed
                      </p>
                    </div>
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#FF6B2B' }}>
                      {first.points} pts
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        <BottomNav />
      </div>
    </>
  )
}

// ─── Podium slot ──────────────────────────────────────────────────────────────

function PodiumSlot({
  entry, medal, rank, size, pedestalHeight, isMe,
}: {
  entry:         LeaderboardEntry
  medal:         string
  rank:          number
  size:          number
  pedestalHeight: number
  isMe:          boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: rank === 1 ? 1.2 : 1 }}>
      {/* Medal */}
      <span style={{ fontSize: rank === 1 ? 28 : 22, marginBottom: 4 }}>{medal}</span>

      {/* Avatar with optional "you" ring */}
      <div style={{
        border: isMe ? '3px solid #FF6B2B' : '3px solid rgba(255,255,255,0.5)',
        borderRadius: '50%',
        padding: 2,
        marginBottom: 8,
      }}>
        <Avatar entry={entry} size={size} />
      </div>

      {/* Name */}
      <p style={{
        fontFamily: '"Poppins", sans-serif', fontWeight: 700,
        fontSize: rank === 1 ? 13 : 11, color: '#fff',
        margin: '0 0 4px', textAlign: 'center',
        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {entry.name}
      </p>

      {/* Points badge */}
      <span style={{
        fontSize: 11, fontWeight: 800,
        background: 'rgba(255,255,255,0.25)',
        color: '#fff', borderRadius: 99,
        padding: '2px 10px', marginBottom: 8,
      }}>
        {entry.points} pts
      </span>

      {/* Pedestal */}
      <div style={{
        width: '100%', height: pedestalHeight,
        background: rank === 1
          ? 'rgba(255,255,255,0.35)'
          : 'rgba(255,255,255,0.2)',
        borderRadius: '10px 10px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Poppins", sans-serif', fontWeight: 800,
        fontSize: rank === 1 ? 20 : 16, color: 'rgba(255,255,255,0.7)',
      }}>
        {rank}
      </div>
    </div>
  )
}
