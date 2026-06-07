'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createHousehold, joinHousehold } from '@/lib/actions/household'
import { createChore } from '@/lib/actions/chores'
import { updateProfile } from '@/lib/actions/auth'

// ─── Fonts ────────────────────────────────────────────────────────────────────

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');`

// ─── Constants ────────────────────────────────────────────────────────────────

const CHORE_TEMPLATES = [
  { name: 'Wash dishes',      emoji: '🍽️', points: 8,  freq: 'daily'   },
  { name: 'Sweep floors',     emoji: '🧹', points: 10, freq: 'weekly'  },
  { name: 'Do laundry',       emoji: '🧺', points: 12, freq: 'weekly'  },
  { name: 'Clean bathroom',   emoji: '🚽', points: 15, freq: 'weekly'  },
  { name: 'Take out trash',   emoji: '🗑️', points: 6,  freq: 'weekly'  },
  { name: 'Vacuum',           emoji: '🌀', points: 10, freq: 'weekly'  },
  { name: 'Mop floors',       emoji: '🪣', points: 12, freq: 'weekly'  },
  { name: 'Clean kitchen',    emoji: '✨', points: 10, freq: 'weekly'  },
  { name: 'Grocery shopping', emoji: '🛒', points: 15, freq: 'weekly'  },
  { name: 'Feed pets',        emoji: '🐾', points: 5,  freq: 'daily'   },
  { name: 'Water plants',     emoji: '🌿', points: 5,  freq: 'weekly'  },
  { name: 'Make beds',        emoji: '🛏️', points: 5,  freq: 'daily'   },
  { name: 'Clean fridge',     emoji: '🧊', points: 10, freq: 'monthly' },
  { name: 'Dust surfaces',    emoji: '✨', points: 8,  freq: 'weekly'  },
] as const

const MEMBER_COLORS = [
  '#FF6B2B','#6366F1','#10B981','#8B5CF6',
  '#EC4899','#F59E0B','#06B6D4','#EF4444',
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'sign-in'        // shown when not logged in and user picks Create/Join
  | 'join'
  | 'admin-name'
  | 'room-name'
  | 'members'
  | 'chores'
  | 'chore-configure'
  | 'rotation'
  | 'success'

type ChoreItem = {
  emoji:     string
  name:      string
  points:    number
  freq:      string
  assignTo:  string   // member name or 'rotate' or 'unassigned'
  isCustom:  boolean
}

type MemberEntry = { id: string; name: string; color: string }

// ─── Step metadata ────────────────────────────────────────────────────────────

const CREATE_STEPS: Step[] = ['admin-name', 'room-name', 'members', 'chores', 'chore-configure', 'rotation']
const CREATE_LABELS = ['You', 'Room', 'People', 'Chores', 'Details', 'Rotation']

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '2px solid #E5E7EB', borderRadius: 12,
  padding: '12px 16px', fontSize: 15, color: '#111827',
  fontFamily: '"Nunito", sans-serif', outline: 'none',
  background: '#fff', fontWeight: 600,
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 7,
  fontFamily: '"Nunito", sans-serif', fontWeight: 800,
  fontSize: 13, color: '#374151',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', padding: '14px',
    borderRadius: 14, border: 'none',
    background: disabled ? '#E5E7EB' : '#FF6B2B',
    color: disabled ? '#9CA3AF' : '#fff',
    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(255,107,43,0.3)',
    transition: 'all 0.15s',
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingClient({ displayName, isLoggedIn, userId }: { displayName: string; isLoggedIn: boolean; userId: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('welcome')
  const [error, setError] = useState<string | null>(null)
  const [pendingPath, setPendingPath] = useState<'create' | 'join'>('create')

  // Admin info
  const [adminName, setAdminName] = useState(displayName === 'there' ? '' : displayName)

  // Household
  const [household, setHousehold] = useState<{ id: string; name: string; invite_code: string } | null>(null)
  const [roomName, setRoomName] = useState('')

  // Members
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [memberInput, setMemberInput] = useState('')

  // Chores
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [chores, setChores] = useState<ChoreItem[]>([])
  const [expandedChore, setExpandedChore] = useState(0)

  // Rotation
  const [rotationType, setRotationType]   = useState<'admin-approval' | 'ai-detection' | 'manual-completion'>('manual-completion')
  const [rotationOrder, setRotationOrder] = useState<string[]>([])

  // Join
  const [joinCode, setJoinCode] = useState('')

  // Success
  const [copied, setCopied] = useState(false)

  function clearError() { setError(null) }

  // ── Step index ────────────────────────────────────────────────────────────
  const stepIdx = CREATE_STEPS.indexOf(step)
  const showProgress = stepIdx !== -1

  // ── Member helpers ────────────────────────────────────────────────────────
  function addMember() {
    const name = memberInput.trim()
    if (!name) return
    if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      setError('That name is already added.')
      return
    }
    setMembers(prev => [...prev, {
      id: `m-${Date.now()}`,
      name,
      color: MEMBER_COLORS[prev.length % MEMBER_COLORS.length],
    }])
    setMemberInput('')
    clearError()
  }

  function removeMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  // ── Chore helpers ─────────────────────────────────────────────────────────
  function toggleTemplate(idx: number) {
    setSelectedTemplates(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function buildChores() {
    const items: ChoreItem[] = []
    selectedTemplates.forEach(idx => {
      const t = CHORE_TEMPLATES[idx]
      items.push({
        emoji: t.emoji, name: t.name, points: t.points,
        freq: t.freq, assignTo: 'rotate', isCustom: false,
      })
    })
    return items
  }

  function addCustomChore() {
    setChores(prev => [...prev, {
      emoji: '✏️', name: '', points: 10,
      freq: 'weekly', assignTo: 'rotate', isCustom: true,
    }])
    setExpandedChore(chores.length)
  }

  function updateChore(i: number, patch: Partial<ChoreItem>) {
    setChores(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }

  function removeChore(i: number) {
    setChores(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Step transitions ──────────────────────────────────────────────────────

  async function handleSaveAdminName() {
    const name = adminName.trim()
    if (!name) { setError('Please enter your name.'); return }
    clearError()
    if (!isLoggedIn) { setStep('room-name'); return }   // preview bypass
    const fd = new FormData()
    fd.append('fullName', name)
    startTransition(async () => {
      await updateProfile(fd)
      setStep('room-name')
    })
  }

  async function handleCreateRoom() {
    const name = roomName.trim()
    if (!name) { setError('Please enter a room name.'); return }
    clearError()
    if (!isLoggedIn) {
      // Preview bypass — mock a household so the rest of the flow works
      setHousehold({ id: 'preview', name, invite_code: 'DEMO01' })
      setStep('members')
      return
    }
    const fd = new FormData()
    fd.append('name', name)
    startTransition(async () => {
      const result = await createHousehold(fd)
      if (result?.error) { setError(result.error); return }
      if (result?.household) {
        setHousehold(result.household as { id: string; name: string; invite_code: string })
        setStep('members')
      }
    })
  }

  function handleMembersNext() {
    clearError()
    const built = buildChores()
    setChores(built)
    setExpandedChore(0)
    setStep('chores')
  }

  function handleChoresNext() {
    if (selectedTemplates.size === 0 && !chores.some(c => c.isCustom)) {
      setError('Add at least one chore to continue, or skip to do this later.')
      return
    }
    clearError()
    const built = buildChores()
    // Merge: keep existing custom chores, replace templates
    const customs = chores.filter(c => c.isCustom)
    setChores([...built, ...customs])
    setExpandedChore(0)
    setStep('chore-configure')
  }

  function handleConfigureNext() {
    const unnamed = chores.filter(c => c.isCustom && !c.name.trim())
    if (unnamed.length) { setError('Give every custom chore a name.'); return }
    clearError()
    setStep('rotation')
  }

  async function handleFinish() {
    if (!household) return
    clearError()
    if (!isLoggedIn) {
      // Resolve final display assignee for every chore before saving.
      // Explicitly assigned chores keep their owner; unassigned chores are
      // distributed in round-robin across all household members so that every
      // person shows up in the dashboard with a non-empty chore list.
      const adminDisplayName = adminName.trim() || 'You'
      const allNames = [adminDisplayName, ...members.map(m => m.name)]
      let rotateIdx = 0
      const resolvedChores = chores
        .filter(c => c.name.trim())
        .map(c => {
          let displayAssignTo: string
          if (c.assignTo === 'me') {
            displayAssignTo = adminDisplayName
          } else if (c.assignTo === 'unassigned' || !c.assignTo) {
            // Distribute unassigned chores round-robin so every member gets some
            displayAssignTo = allNames[rotateIdx % allNames.length]
            rotateIdx++
          } else {
            displayAssignTo = c.assignTo  // already a specific member's name
          }
          return { name: c.name, emoji: c.emoji, points: c.points, freq: c.freq, displayAssignTo }
        })

      try {
        sessionStorage.setItem('cs_preview_onboarding', JSON.stringify({
          name: household.name,
          members: [
            { name: adminDisplayName, color: '#FF6B2B', avatarUrl: null, isMe: true },
            ...members.map(m => ({ name: m.name, color: m.color, avatarUrl: null, isMe: false })),
          ],
          chores: resolvedChores,
        }))
      } catch { /* ignore */ }
      router.push('/dashboard')
      return
    }
    const today = new Date().toISOString().split('T')[0]
    startTransition(async () => {
      for (const chore of chores) {
        const name = chore.name.trim()
        if (!name) continue
        const fd = new FormData()
        fd.append('household_id', household.id)
        fd.append('name', name)
        fd.append('points', String(chore.points))
        fd.append('frequency', chore.freq)
        fd.append('category', 'general')
        fd.append('due_date', today)   // show immediately in dashboard
        // Assign "me" chores to the actual logged-in user
        if (chore.assignTo === 'me' && userId) {
          fd.append('assigned_to', userId)
        }
        const result = await createChore(fd)
        if (result && 'error' in result && result.error) {
          setError(result.error)
          return
        }
      }
      setStep('success')
    })
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearError()
    if (!isLoggedIn) { router.push('/dashboard'); return }  // preview bypass
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await joinHousehold(fd)
      if (result?.error) setError(result.error)
      else router.push('/dashboard')
    })
  }

  async function copyCode() {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #FF6B2B 0%, #ff8f5e 55%, #ffb347 100%)',
        fontFamily: '"Nunito", sans-serif',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 48px',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 16, color: '#fff',
          }}>CS</div>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#fff' }}>
            ChoreSync
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 480,
          background: '#fff', borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}>

          {/* Progress bar */}
          {showProgress && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 4 }}>
                {CREATE_LABELS.map((label, i) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', marginBottom: 3,
                      background: stepIdx > i ? '#FF6B2B' : stepIdx === i ? '#FF6B2B' : '#E5E7EB',
                      color: stepIdx >= i ? '#fff' : '#9CA3AF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 11,
                      transition: 'background 0.3s',
                    }}>
                      {stepIdx > i ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: stepIdx === i ? '#FF6B2B' : '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 4, background: '#F3F4F6', borderRadius: 99 }}>
                <div style={{
                  height: '100%', background: '#FF6B2B', borderRadius: 99,
                  width: `${((stepIdx + 1) / CREATE_STEPS.length) * 100}%`,
                  transition: 'width 0.35s ease',
                }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', color: '#DC2626', borderRadius: 12,
              padding: '10px 14px', fontSize: 13, fontWeight: 600,
              marginBottom: 16, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* ── WELCOME ─────────────────────────────────────────────────────── */}
          {step === 'welcome' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🏡</div>
                <h1 style={{
                  fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                  fontSize: 26, color: '#111827', margin: '0 0 8px',
                }}>
                  Welcome to ChoreSync
                </h1>
                <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                  Sync chores with your household.<br />Create a room or join one.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Create Room */}
                <button
                  type="button"
                  onClick={() => {
                    clearError()
                    setStep('admin-name')
                  }}
                  style={{
                    background: '#FF6B2B', border: 'none', borderRadius: 18,
                    padding: '22px 20px', cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 6px 20px rgba(255,107,43,0.35)',
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🏡</div>
                  <p style={{
                    fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                    fontSize: 17, color: '#fff', margin: '0 0 4px',
                  }}>
                    Create Room
                  </p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', margin: 0 }}>
                    Set up your household and invite people
                  </p>
                </button>

                {/* Join Room */}
                <button
                  type="button"
                  onClick={() => {
                    clearError()
                    setStep('join')
                  }}
                  style={{
                    background: '#fff', border: '2px solid #E5E7EB',
                    borderRadius: 18, padding: '22px 20px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🔑</div>
                  <p style={{
                    fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                    fontSize: 17, color: '#111827', margin: '0 0 4px',
                  }}>
                    Join Room
                  </p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                    Enter your housemate's invite code
                  </p>
                </button>
              </div>

              {/* Dashboard shortcut — quick access for dev/returning users */}
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                style={{
                  display: 'block', width: '100%', marginTop: 20,
                  padding: '11px', borderRadius: 12,
                  border: '1.5px solid #E5E7EB', background: 'transparent',
                  fontSize: 13, fontWeight: 700, color: '#6B7280',
                  cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                }}
              >
                → Go to Dashboard
              </button>
            </div>
          )}

          {/* ── SIGN IN (shown when not logged in) ──────────────────────────── */}
          {step === 'sign-in' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('welcome') }} />
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>
                  {pendingPath === 'create' ? '🏡' : '🔑'}
                </div>
                <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 8px' }}>
                  {pendingPath === 'create' ? 'Create your room' : 'Join a room'}
                </h2>
                <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                  Sign in or create an account to continue.<br />It only takes a minute.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href={`/login?tab=signup&redirectTo=/onboarding`}
                  style={{
                    display: 'block', textAlign: 'center',
                    background: '#FF6B2B', color: '#fff',
                    borderRadius: 14, padding: '14px',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(255,107,43,0.3)',
                  }}
                >
                  Create account →
                </a>
                <a
                  href={`/login?redirectTo=/onboarding`}
                  style={{
                    display: 'block', textAlign: 'center',
                    background: '#fff', color: '#374151',
                    borderRadius: 14, padding: '13px',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
                    textDecoration: 'none',
                    border: '2px solid #E5E7EB',
                  }}
                >
                  Sign in to existing account
                </a>
              </div>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', margin: '20px 0 0' }}>
                Your progress is saved — you'll return right here after signing in.
              </p>
            </div>
          )}

          {/* ── JOIN ────────────────────────────────────────────────────────── */}
          {step === 'join' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('welcome') }} />
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔑</div>
                <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 6px' }}>
                  Join a Room
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Enter the 6-character code from your housemate
                </p>
              </div>
              <form onSubmit={handleJoin}>
                <input type="hidden" name="code" value={joinCode} />
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  spellCheck={false}
                  style={{
                    ...inputStyle,
                    textAlign: 'center', fontSize: 34, fontFamily: 'monospace',
                    fontWeight: 900, letterSpacing: '0.45em',
                    padding: '16px 14px', color: '#FF6B2B',
                    marginBottom: 8, border: '2px solid #E5E7EB',
                  }}
                />
                <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', margin: '0 0 20px' }}>
                  Not case-sensitive · letters &amp; numbers only
                </p>
                <button type="submit" disabled={isPending || joinCode.length < 6} style={primaryBtn(isPending || joinCode.length < 6)}>
                  {isPending ? 'Joining…' : 'Join Room →'}
                </button>
              </form>
            </div>
          )}

          {/* ── ADMIN NAME ──────────────────────────────────────────────────── */}
          {step === 'admin-name' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('welcome') }} />
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
                <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 6px' }}>
                  What's your name?
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  This is how you'll appear to your housemates.
                </p>
              </div>

              <label style={labelStyle}>Your name</label>
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveAdminName()}
                placeholder="e.g. Jordan Rivera"
                autoFocus
                maxLength={60}
                style={{ ...inputStyle, marginBottom: 20, fontSize: 16 }}
              />
              <button
                type="button"
                onClick={handleSaveAdminName}
                disabled={isPending || !adminName.trim()}
                style={primaryBtn(isPending || !adminName.trim())}
              >
                {isPending ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          )}

          {/* ── ROOM NAME ───────────────────────────────────────────────────── */}
          {step === 'room-name' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('admin-name') }} />
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏡</div>
                <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 6px' }}>
                  Name your Room
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Give your household a name your crew will recognize.
                </p>
              </div>

              <label style={labelStyle}>Room name</label>
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                placeholder='e.g. "Sunrise Apt" or "The Smith House"'
                autoFocus
                maxLength={80}
                style={{ ...inputStyle, marginBottom: 8, fontSize: 15, textAlign: 'center', fontWeight: 700 }}
              />
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px', textAlign: 'center' }}>
                You can rename this anytime from settings.
              </p>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isPending || !roomName.trim()}
                style={primaryBtn(isPending || !roomName.trim())}
              >
                {isPending ? 'Creating…' : 'Continue →'}
              </button>
            </div>
          )}

          {/* ── MEMBERS ─────────────────────────────────────────────────────── */}
          {step === 'members' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('room-name') }} />
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 4px' }}>
                  Who lives with you?
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Add your housemates' names so you can assign chores. They'll join using your invite code later.
                </p>
              </div>

              {/* Input row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={memberInput}
                  onChange={e => { setMemberInput(e.target.value); clearError() }}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="Housemate's name…"
                  maxLength={40}
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!memberInput.trim()}
                  style={{
                    padding: '0 18px', borderRadius: 12, border: 'none',
                    background: memberInput.trim() ? '#FF6B2B' : '#E5E7EB',
                    color: memberInput.trim() ? '#fff' : '#9CA3AF',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
                    cursor: memberInput.trim() ? 'pointer' : 'default', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  Add
                </button>
              </div>

              {/* Member list */}
              {members.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {/* Current user (you) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#FFF8F5', borderRadius: 12, padding: '10px 14px',
                    border: '1.5px solid #FFD5C2',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: '#FF6B2B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
                    }}>
                      {adminName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'ME'}
                    </div>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#111827' }}>
                      {adminName.trim()} <span style={{ fontSize: 11, color: '#FF6B2B', fontWeight: 700 }}>(You · Admin)</span>
                    </span>
                  </div>

                  {members.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#F9FAFB', borderRadius: 12, padding: '10px 14px',
                      border: '1.5px solid #E5E7EB',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', background: m.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
                      }}>
                        {m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#111827' }}>{m.name}</span>
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#D1D5DB', fontSize: 18, lineHeight: 1, padding: '0 2px',
                        }}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {members.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '20px 0',
                  color: '#D1D5DB', fontSize: 13, marginBottom: 16,
                }}>
                  No housemates added yet — you can also skip this and invite later.
                </div>
              )}

              {/* Invite link card — shown once household exists */}
              {household && (
                <div style={{
                  background: '#FFF8F5', border: '1.5px dashed #FFB899',
                  borderRadius: 14, padding: '14px 16px', marginBottom: 14,
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#FF6B2B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    📨 Invite housemates
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                    Share this link or code — they can join from any device.
                  </p>
                  {/* Code pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 20, fontWeight: 900,
                      letterSpacing: '0.25em', color: '#FF6B2B',
                      background: '#fff', border: '1.5px solid #FFD5C2',
                      borderRadius: 8, padding: '4px 12px', flex: 1, textAlign: 'center',
                    }}>
                      {household.invite_code}
                    </span>
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/join/${household.invite_code}`
                        navigator.clipboard?.writeText(url)
                      }}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 10,
                        border: '1.5px solid #E5E7EB', background: '#fff',
                        fontSize: 12, fontWeight: 700, color: '#374151',
                        cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                      }}
                    >
                      🔗 Copy Link
                    </button>
                    {'share' in navigator && (
                      <button
                        type="button"
                        onClick={() => navigator.share?.({
                          title: `Join ${household.name} on ChoreSync`,
                          text: `Use code ${household.invite_code} to join my household`,
                          url: `${window.location.origin}/join/${household.invite_code}`,
                        })}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10,
                          border: 'none', background: '#FF6B2B', color: '#fff',
                          fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: '"Nunito", sans-serif',
                        }}
                      >
                        📤 Share
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button type="button" onClick={handleMembersNext} style={primaryBtn(false)}>
                {members.length === 0 ? 'Skip for now →' : `Continue with ${members.length + 1} people →`}
              </button>
            </div>
          )}

          {/* ── CHORES ──────────────────────────────────────────────────────── */}
          {step === 'chores' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('members') }} />
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 4px' }}>
                Add your chores
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                Pick common ones or create your own. Points are awarded on completion.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {CHORE_TEMPLATES.map((t, i) => {
                  const sel = selectedTemplates.has(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleTemplate(i)}
                      style={{
                        background: sel ? '#FFF3EE' : '#fff',
                        border: `2px solid ${sel ? '#FF6B2B' : '#F0F0F0'}`,
                        borderRadius: 14, padding: '12px 10px', cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: sel ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                        transition: 'all 0.15s',
                        position: 'relative',
                      }}
                    >
                      {sel && (
                        <div style={{
                          position: 'absolute', top: 6, right: 8,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#FF6B2B', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 900,
                        }}>✓</div>
                      )}
                      <div style={{ fontSize: 22, marginBottom: 5 }}>{t.emoji}</div>
                      <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 11, color: '#111827', margin: '0 0 3px' }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>🏆 {t.points} pts</p>
                    </button>
                  )
                })}
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
                <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
              </div>

              <button
                type="button"
                onClick={() => {
                  const built = buildChores()
                  const customs = chores.filter(c => c.isCustom)
                  const merged = [...built, ...customs]
                  setChores(merged)
                  addCustomChore()
                  clearError()
                  setStep('chore-configure')
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '12px', borderRadius: 14,
                  border: '2px dashed #E5E7EB', background: '#F9FAFB',
                  color: '#6B7280', cursor: 'pointer', marginBottom: 16,
                  fontFamily: '"Nunito", sans-serif', fontWeight: 700, fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                ✏️ Create a custom chore
              </button>

              <button
                type="button"
                onClick={handleChoresNext}
                disabled={selectedTemplates.size === 0}
                style={selectedTemplates.size === 0
                  ? { ...primaryBtn(true) }
                  : primaryBtn(false)
                }
              >
                {selectedTemplates.size === 0
                  ? 'Select chores to continue'
                  : `Continue with ${selectedTemplates.size} chore${selectedTemplates.size !== 1 ? 's' : ''} →`}
              </button>
            </div>
          )}

          {/* ── CHORE CONFIGURE ─────────────────────────────────────────────── */}
          {step === 'chore-configure' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('chores') }} />
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 4px' }}>
                Configure chores
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                Set points, frequency, and who's assigned. You can change these anytime.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {chores.map((chore, i) => {
                  const open = expandedChore === i
                  return (
                    <div key={i} style={{
                      border: `2px solid ${open ? '#FF6B2B' : '#F0F0F0'}`,
                      borderRadius: 14, overflow: 'hidden',
                      boxShadow: open ? '0 0 0 3px rgba(255,107,43,0.1)' : 'none',
                    }}>
                      {/* Header */}
                      <button
                        type="button"
                        onClick={() => setExpandedChore(open ? -1 : i)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: open ? '#FFF8F5' : '#fff',
                          border: 'none', cursor: 'pointer',
                          padding: '12px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{chore.emoji}</span>
                          <span style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 14, color: '#111827' }}>
                            {chore.name || 'Custom chore'} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>· {chore.points} pts</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeChore(i) }}
                            style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                            aria-label="Remove chore"
                          >×</button>
                          <span style={{ color: '#9CA3AF', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {/* Body */}
                      {open && (
                        <div style={{ padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Name (custom only) */}
                          {chore.isCustom && (
                            <div>
                              <label style={labelStyle}>Chore name</label>
                              <input
                                type="text"
                                value={chore.name}
                                onChange={e => updateChore(i, { name: e.target.value })}
                                placeholder="e.g. Clean the garage"
                                style={inputStyle}
                                autoFocus
                              />
                            </div>
                          )}

                          {/* Points */}
                          <div>
                            <label style={labelStyle}>Points  <span style={{ color: '#9CA3AF', fontWeight: 600 }}>({chore.points} pts)</span></label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <input
                                type="range"
                                min={1} max={50}
                                value={chore.points}
                                onChange={e => updateChore(i, { points: Number(e.target.value) })}
                                style={{ flex: 1, accentColor: '#FF6B2B' }}
                              />
                              <span style={{
                                width: 42, height: 32, borderRadius: 8,
                                background: '#FFF3EE', border: '1.5px solid #FFD5C2',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13, color: '#FF6B2B', flexShrink: 0,
                              }}>
                                {chore.points}
                              </span>
                            </div>
                          </div>

                          {/* Frequency */}
                          <div>
                            <label style={labelStyle}>Frequency</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                              {['daily','weekly','monthly','one-time'].map(f => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => updateChore(i, { freq: f })}
                                  style={{
                                    padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                                    fontFamily: '"Nunito", sans-serif', cursor: 'pointer',
                                    border: `2px solid ${chore.freq === f ? '#FF6B2B' : '#E5E7EB'}`,
                                    background: chore.freq === f ? '#FFF3EE' : '#fff',
                                    color: chore.freq === f ? '#FF6B2B' : '#6B7280',
                                    textTransform: 'capitalize' as const, transition: 'all 0.15s',
                                  }}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Assign */}
                          <div>
                            <label style={labelStyle}>Assign to</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {/* Me option */}
                              <button
                                type="button"
                                onClick={() => updateChore(i, { assignTo: 'me' })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                  border: `2px solid ${chore.assignTo === 'me' ? '#FF6B2B' : '#E5E7EB'}`,
                                  background: chore.assignTo === 'me' ? '#FFF3EE' : '#fff',
                                  textAlign: 'left',
                                }}
                              >
                                <span style={{ fontSize: 18 }}>😊</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Me ({adminName.split(' ')[0]})</span>
                              </button>

                              {/* Named members */}
                              {members.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => updateChore(i, { assignTo: m.name })}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                    border: `2px solid ${chore.assignTo === m.name ? '#FF6B2B' : '#E5E7EB'}`,
                                    background: chore.assignTo === m.name ? '#FFF3EE' : '#fff',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div style={{
                                    width: 24, height: 24, borderRadius: '50%', background: m.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0,
                                  }}>
                                    {m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{m.name}</span>
                                </button>
                              ))}

                              {/* Unassigned */}
                              <button
                                type="button"
                                onClick={() => updateChore(i, { assignTo: 'unassigned' })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                  border: `2px solid ${chore.assignTo === 'unassigned' ? '#FF6B2B' : '#E5E7EB'}`,
                                  background: chore.assignTo === 'unassigned' ? '#FFF3EE' : '#fff',
                                  textAlign: 'left',
                                }}
                              >
                                <span style={{ fontSize: 18 }}>👥</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Leave unassigned</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add another custom */}
              <button
                type="button"
                onClick={addCustomChore}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px', borderRadius: 12,
                  border: '2px dashed #E5E7EB', background: '#F9FAFB',
                  color: '#6B7280', cursor: 'pointer', marginBottom: 16,
                  fontFamily: '"Nunito", sans-serif', fontWeight: 700, fontSize: 13,
                }}
              >
                + Add another chore
              </button>

              <button type="button" onClick={handleConfigureNext} style={primaryBtn(false)}>
                Continue →
              </button>
            </div>
          )}

          {/* ── ROTATION ────────────────────────────────────────────────────── */}
          {step === 'rotation' && (
            <div>
              <BackBtn onClick={() => { clearError(); setStep('chore-configure') }} />
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 4px' }}>
                Rotation &amp; assignment
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
                How should chores rotate between household members over time?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {([
                  {
                    id: 'manual-completion' as const,
                    emoji: '✅',
                    title: 'Manual Completion',
                    desc: 'Each person checks off their own chore. The chore automatically moves to the next person in the rotation — no double-assignments until everyone has had a turn.',
                    badge: 'Recommended',
                  },
                  {
                    id: 'admin-approval' as const,
                    emoji: '👑',
                    title: "Admin's Word",
                    desc: 'Members submit a photo when done. You (the admin) approve or decline each completion. You also control who is next in the rotation.',
                    badge: null,
                  },
                  {
                    id: 'ai-detection' as const,
                    emoji: '🤖',
                    title: 'AI Completion Detection',
                    desc: 'Members submit a photo and AI automatically checks whether the chore was done correctly. Instant, objective, no admin required.',
                    badge: 'Beta',
                  },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setRotationType(opt.id)
                      // Seed rotation order from current member list
                      if (opt.id === 'admin-approval' && rotationOrder.length === 0) {
                        setRotationOrder([adminName.split(' ')[0], ...members.map(m => m.name.split(' ')[0])])
                      }
                    }}
                    style={{
                      position: 'relative', textAlign: 'left',
                      background: rotationType === opt.id ? '#FFF3EE' : '#fff',
                      border: `2px solid ${rotationType === opt.id ? '#FF6B2B' : '#F0F0F0'}`,
                      borderRadius: 16, padding: '16px',
                      cursor: 'pointer',
                      boxShadow: rotationType === opt.id ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.badge && (
                      <span style={{
                        position: 'absolute', top: 12, right: 12,
                        fontSize: 10, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 99,
                        background: opt.badge === 'Beta' ? '#EEF2FF' : '#EAF3DE',
                        color: opt.badge === 'Beta' ? '#4338CA' : '#27500A',
                      }}>
                        {opt.badge}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.emoji}</span>
                      <div>
                        <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15, color: '#111827', margin: '0 0 4px' }}>
                          {opt.title}
                        </p>
                        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Rotation order — only for Admin's Word */}
              {rotationType === 'admin-approval' && (() => {
                const order = rotationOrder.length > 0
                  ? rotationOrder
                  : [adminName.split(' ')[0], ...members.map(m => m.name.split(' ')[0])]

                function move(idx: number, dir: -1 | 1) {
                  const next = [...order]
                  const swap = idx + dir
                  if (swap < 0 || swap >= next.length) return
                  ;[next[idx], next[swap]] = [next[swap], next[idx]]
                  setRotationOrder(next)
                }

                return (
                  <div style={{
                    background: '#F9FAFB', borderRadius: 14, padding: '14px 16px',
                    marginBottom: 16, border: '1.5px solid #E5E7EB',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                      Rotation order — drag to reorder
                    </p>
                    {order.map((name, idx) => (
                      <div key={name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 0',
                        borderBottom: idx < order.length - 1 ? '0.5px solid #E5E7EB' : 'none',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#D1D5DB', width: 18, textAlign: 'center' }}>
                          {idx + 1}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>{name}</span>
                        {idx === 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#FFF3EE', color: '#FF6B2B' }}>
                            Up next
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                            style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, width: 26, height: 26, cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#D1D5DB' : '#6B7280', fontSize: 12 }}>
                            ↑
                          </button>
                          <button type="button" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}
                            style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, width: 26, height: 26, cursor: idx === order.length - 1 ? 'default' : 'pointer', color: idx === order.length - 1 ? '#D1D5DB' : '#6B7280', fontSize: 12 }}>
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Preview */}
              {chores.length > 0 && (
                <div style={{
                  background: '#F9FAFB', borderRadius: 14, padding: '14px 16px',
                  marginBottom: 20, border: '1.5px solid #E5E7EB',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                    {rotationType === 'manual-completion' ? 'Auto-rotation preview' : rotationType === 'admin-approval' ? 'First cycle preview' : 'AI verification preview'}
                  </p>
                  {chores.slice(0, 4).map((chore, i) => {
                    const allPeople = rotationOrder.length > 0
                      ? rotationOrder
                      : [adminName.split(' ')[0], ...members.map(m => m.name.split(' ')[0])]
                    const person = allPeople.length > 0 ? allPeople[i % allPeople.length] : '—'
                    const suffix = rotationType === 'ai-detection' ? ' 📸' : rotationType === 'admin-approval' ? ' 👑' : ''
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: i < Math.min(chores.length, 4) - 1 ? '0.5px solid #E5E7EB' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: '#374151' }}>{chore.emoji} {chore.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B2B' }}>
                          {person}{suffix}
                        </span>
                      </div>
                    )
                  })}
                  {chores.length > 4 && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0', textAlign: 'center' }}>
                      +{chores.length - 4} more chores
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleFinish}
                disabled={isPending}
                style={{ ...primaryBtn(isPending), background: isPending ? '#E5E7EB' : '#10B981', boxShadow: isPending ? 'none' : '0 4px 14px rgba(16,185,129,0.35)' }}
              >
                {isPending ? 'Setting up your room…' : '🎉 Create Room'}
              </button>
            </div>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────────────── */}
          {step === 'success' && household && (
            <SuccessScreen
              household={household}
              router={router}
            />
          )}
        </div>
      </div>
    </>
  )
}

function SuccessScreen({
  household,
  router,
}: {
  household: { id: string; name: string; invite_code: string }
  router:    ReturnType<typeof useRouter>
}) {
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Auto-redirect to dashboard after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval)
          router.push('/dashboard')
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  function copyCode() {
    navigator.clipboard?.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 24, color: '#111827', margin: '0 0 8px' }}>
                {household.name} is ready!
              </h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
                Share your invite code so housemates can join on their own device.
              </p>

              {/* Invite code */}
              <div style={{
                border: '2px dashed #FF6B2B', borderRadius: 20,
                background: '#FFF8F5', padding: '22px 16px', marginBottom: 8,
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#FF6B2B', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>
                  Invite Code
                </p>
                <p style={{ fontFamily: 'monospace', fontSize: 42, fontWeight: 900, letterSpacing: '0.35em', color: '#FF6B2B', margin: 0 }}>
                  {household.invite_code}
                </p>
              </div>

              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
                Housemates enter this on the Join Room screen.
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={copyCode}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: copied ? '#ECFDF5' : '#F3F4F6',
                    border: `2px solid ${copied ? '#6EE7B7' : '#E5E7EB'}`,
                    color: copied ? '#059669' : '#374151',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy code'}
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={() => navigator.share({ title: `Join ${household.name}`, text: `Join my household on ChoreSync! Code: ${household.invite_code}` })}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      background: '#F3F4F6', border: '2px solid #E5E7EB',
                      color: '#374151',
                      fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    ↗ Share
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                style={primaryBtn(false)}
              >
                Go to Dashboard → {countdown > 0 && `(${countdown})`}
              </button>
            </div>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: '"Nunito", sans-serif', fontWeight: 800,
        fontSize: 13, color: '#9CA3AF', marginBottom: 18,
      }}
    >
      ← Back
    </button>
  )
}
