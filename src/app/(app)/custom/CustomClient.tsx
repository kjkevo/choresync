'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createChore } from '@/lib/actions/chores'
import BottomNav from '@/components/ui/BottomNav'
import type { UserRow } from '@/lib/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
`

const TEMPLATES = [
  { name: 'Sweep floors',     emoji: '🧹', category: 'general',   defaultPoints: 10 },
  { name: 'Wash dishes',      emoji: '🍽️', category: 'kitchen',   defaultPoints: 8  },
  { name: 'Do laundry',       emoji: '🧺', category: 'laundry',   defaultPoints: 12 },
  { name: 'Clean bathroom',   emoji: '🚽', category: 'general',   defaultPoints: 15 },
  { name: 'Take out trash',   emoji: '🗑️', category: 'general',   defaultPoints: 6  },
  { name: 'Vacuum',           emoji: '🌀', category: 'general',   defaultPoints: 10 },
  { name: 'Mop floors',       emoji: '🪣', category: 'general',   defaultPoints: 12 },
  { name: 'Clean kitchen',    emoji: '✨', category: 'kitchen',   defaultPoints: 10 },
  { name: 'Grocery shopping', emoji: '🛒', category: 'general',   defaultPoints: 15 },
  { name: 'Feed pets',        emoji: '🐾', category: 'general',   defaultPoints: 5  },
  { name: 'Water plants',     emoji: '🌿', category: 'general',   defaultPoints: 5  },
  { name: 'Make beds',        emoji: '🛏️', category: 'bedroom',   defaultPoints: 5  },
  { name: 'Dust surfaces',    emoji: '✨', category: 'general',   defaultPoints: 8  },
  { name: 'Clean fridge',     emoji: '🧊', category: 'kitchen',   defaultPoints: 10 },
] as const

const FREQUENCIES = ['one-time', 'daily', 'weekly', 'monthly'] as const
type Frequency = typeof FREQUENCIES[number]

const JUDGMENT_OPTIONS = [
  {
    id:       'self' as const,
    icon:     '✅',
    title:    'Just a checkmark',
    desc:     'Member marks it done themselves. Simple and trusted.',
    disabled: false,
  },
  {
    id:       'vote' as const,
    icon:     '👥',
    title:    'Group vote',
    desc:     'Household members vote to approve completion.',
    disabled: false,
  },
  {
    id:       'ai' as const,
    icon:     '🤖',
    title:    'AI review',
    desc:     'Upload a photo and AI decides if the chore is done well.',
    disabled: true,
  },
]

type JudgmentType = 'self' | 'vote' | 'ai'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomClientProps {
  householdId:   string
  members:       UserRow[]
  currentUserId: string
  /** When true: no page shell, no header, no BottomNav — renders inline */
  embedded?:     boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomClient({ householdId, members, currentUserId, embedded = false }: CustomClientProps) {
  const [step,             setStep]           = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<number | 'custom' | null>(null)
  const [choreName,        setChoreName]      = useState('')
  const [points,           setPoints]         = useState(10)
  const [dueDate,          setDueDate]        = useState('')
  const [frequency,        setFrequency]      = useState<Frequency>('one-time')
  const [description,      setDescription]   = useState('')
  const [assignedTo,       setAssignedTo]     = useState<string | null>(null)
  const [rotateEnabled,    setRotateEnabled]  = useState(false)
  const [rotationOrder,    setRotationOrder]  = useState<string[]>(members.map(m => m.id))
  const [judgment,         setJudgment]       = useState<JudgmentType>('self')
  const [submitting,       setSubmitting]     = useState(false)
  const [error,            setError]          = useState<string | null>(null)
  const [success,          setSuccess]        = useState(false)

  const totalSteps = 4
  const progress   = (step / totalSteps) * 100

  // ── Step 1 handlers ────────────────────────────────────────────────────────

  function handleSelectTemplate(idx: number) {
    const t = TEMPLATES[idx]
    setSelectedTemplate(idx)
    setChoreName(t.name)
    setPoints(t.defaultPoints)
  }

  function handleSelectCustom() {
    setSelectedTemplate('custom')
    setChoreName('')
    setPoints(10)
  }

  function canAdvanceStep1() {
    return selectedTemplate !== null
  }

  // ── Step 3: rotation order helpers ────────────────────────────────────────

  function moveUp(idx: number) {
    if (idx === 0) return
    const arr = [...rotationOrder]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    setRotationOrder(arr)
  }

  function moveDown(idx: number) {
    if (idx === rotationOrder.length - 1) return
    const arr = [...rotationOrder]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    setRotationOrder(arr)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    setSubmitting(true)
    setError(null)

    const fd = new FormData()
    fd.append('household_id', householdId)
    fd.append('name',         choreName.trim())
    fd.append('points',       String(points))
    fd.append('frequency',    frequency)
    fd.append('category',     selectedTemplate !== null && selectedTemplate !== 'custom'
      ? TEMPLATES[selectedTemplate as number].category
      : 'general'
    )
    if (description) fd.append('description', description)
    if (dueDate)     fd.append('due_date',    dueDate)

    if (rotateEnabled && members.length >= 2) {
      fd.append('rotation_enabled',  'true')
      fd.append('rotation_members',  JSON.stringify(rotationOrder))
    } else if (assignedTo) {
      fd.append('assigned_to', assignedTo)
    }

    if (judgment === 'ai') fd.append('require_photo', 'true')

    const result = await createChore(fd)
    setSubmitting(false)

    if (result && 'error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    if (embedded) {
      return (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 22, color: '#111827', margin: '0 0 8px' }}>Chore created!</h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>Your household chore is ready to go.</p>
          <button
            type="button"
            onClick={() => { setSuccess(false); setStep(1); setSelectedTemplate(null); setChoreName(''); setPoints(10); setDueDate(''); setFrequency('one-time'); setDescription(''); setAssignedTo(null); setRotateEnabled(false); setJudgment('self') }}
            style={{ background: '#FF6B2B', color: '#fff', border: 'none', borderRadius: 14, padding: '13px 32px', fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Create another
          </button>
        </div>
      )
    }
    return (
      <>
        <style>{FONTS}</style>
        <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: '"Nunito", sans-serif', paddingBottom: 80 }}>
          <Header />
          <div style={{ maxWidth: 500, margin: '80px auto 0', padding: '0 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 24, color: '#111827', margin: '0 0 8px' }}>
              Chore created!
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 32px' }}>
              Your household chore is ready to go.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href="/dashboard" style={{
                display: 'block', background: '#FF6B2B', color: '#fff',
                borderRadius: 14, padding: '14px 24px',
                fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
                textDecoration: 'none', textAlign: 'center',
              }}>
                Go to Dashboard
              </a>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false); setStep(1); setSelectedTemplate(null)
                  setChoreName(''); setPoints(10); setDueDate(''); setFrequency('one-time')
                  setDescription(''); setAssignedTo(null); setRotateEnabled(false)
                  setJudgment('self')
                }}
                style={{
                  background: '#F3F4F6', color: '#374151', border: 'none',
                  borderRadius: 14, padding: '14px 24px',
                  fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Create another
              </button>
            </div>
          </div>
          <BottomNav />
        </div>
      </>
    )
  }

  return (
    <>
      {!embedded && <style>{FONTS}</style>}
      <div style={embedded
        ? { fontFamily: '"Nunito", sans-serif' }
        : { minHeight: '100vh', background: '#F7F8FA', fontFamily: '"Nunito", sans-serif', paddingBottom: 80 }
      }>
        {!embedded && <Header />}

        {/* Progress bar */}
        <div style={embedded
          ? { background: '#F3F4F6', borderRadius: 14, padding: '12px 4px 14px', marginBottom: 16 }
          : { background: '#fff', borderBottom: '1px solid #F0F0F0', padding: '12px 16px' }
        }>
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {['Template', 'Configure', 'Assign', 'Judgment'].map((label, i) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: step > i + 1 ? '#FF6B2B' : step === i + 1 ? '#FF6B2B' : '#E5E7EB',
                    color: step >= i + 1 ? '#fff' : '#9CA3AF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 12,
                    marginBottom: 4,
                  }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: step === i + 1 ? '#FF6B2B' : '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 99 }}>
              <div style={{
                height: '100%', background: '#FF6B2B', borderRadius: 99,
                width: `${progress}%`, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>

        <main style={embedded
          ? { padding: '0 0 16px' }
          : { maxWidth: 500, margin: '0 auto', padding: '20px 16px 0' }
        }>

          {/* ── Step 1: Template ──────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 4px' }}>
                Choose a template
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
                Pick a common chore or write your own.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {TEMPLATES.map((t, idx) => {
                  const sel = selectedTemplate === idx
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectTemplate(idx)}
                      style={{
                        background: '#fff', border: `2px solid ${sel ? '#FF6B2B' : '#F0F0F0'}`,
                        borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
                        textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: sel ? '0 0 0 3px rgba(255,107,43,0.15)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{t.emoji}</div>
                      <p style={{
                        fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                        fontSize: 12, color: '#111827', margin: '0 0 3px',
                      }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                        🏆 {t.defaultPoints} pts
                      </p>
                    </button>
                  )
                })}

                {/* Custom card */}
                <button
                  type="button"
                  onClick={handleSelectCustom}
                  style={{
                    background: selectedTemplate === 'custom' ? '#FFF3EE' : '#fff',
                    border: `2px solid ${selectedTemplate === 'custom' ? '#FF6B2B' : '#F0F0F0'}`,
                    borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
                    textAlign: 'left', transition: 'border-color 0.15s',
                    boxShadow: selectedTemplate === 'custom' ? '0 0 0 3px rgba(255,107,43,0.15)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>✏️</div>
                  <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 12, color: '#111827', margin: '0 0 3px' }}>
                    Custom
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Write your own</p>
                </button>
              </div>

              <StepButtons
                step={step} totalSteps={totalSteps}
                canNext={canAdvanceStep1()}
                onBack={() => setStep(s => s - 1)}
                onNext={() => setStep(s => s + 1)}
              />
            </div>
          )}

          {/* ── Step 2: Configure ─────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 4px' }}>
                Configure your chore
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
                Set the details for this chore.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Chore name */}
                <div>
                  <label style={labelStyle}>Chore name</label>
                  <input
                    type="text"
                    value={choreName}
                    onChange={e => setChoreName(e.target.value)}
                    placeholder="e.g. Sweep the kitchen floor"
                    style={inputStyle}
                  />
                </div>

                {/* Points */}
                <div>
                  <label style={labelStyle}>Points</label>
                  <input
                    type="number"
                    min={1} max={100}
                    value={points}
                    onChange={e => setPoints(Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>

                {/* Due date */}
                <div>
                  <label style={labelStyle}>Due date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FREQUENCIES.map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        style={{
                          padding: '8px 14px', borderRadius: 99,
                          border: `2px solid ${frequency === f ? '#FF6B2B' : '#E5E7EB'}`,
                          background: frequency === f ? '#FFF3EE' : '#fff',
                          color: frequency === f ? '#FF6B2B' : '#6B7280',
                          fontFamily: '"Nunito", sans-serif', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', transition: 'all 0.15s',
                          textTransform: 'capitalize' as const,
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Any extra details..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' as const, height: 'auto' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <StepButtons
                  step={step} totalSteps={totalSteps}
                  canNext={choreName.trim().length > 0}
                  onBack={() => setStep(s => s - 1)}
                  onNext={() => setStep(s => s + 1)}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Assign ────────────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 4px' }}>
                Assign & rotate
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
                Who is responsible for this chore?
              </p>

              {/* Rotation toggle */}
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0',
                padding: '16px', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 14, color: '#111827', margin: 0 }}>
                    Rotate after completion
                  </p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
                    Cycle through household members automatically
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRotateEnabled(v => !v)}
                  style={{
                    width: 48, height: 28, borderRadius: 99,
                    background: rotateEnabled ? '#FF6B2B' : '#E5E7EB',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: rotateEnabled ? 23 : 3,
                    width: 22, height: 22, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              {rotateEnabled ? (
                /* Rotation order */
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #F7F8FA' }}>
                    <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 13, color: '#374151', margin: 0 }}>
                      Rotation order
                    </p>
                  </div>
                  {rotationOrder.map((uid, idx) => {
                    const member = members.find(m => m.id === uid)
                    if (!member) return null
                    return (
                      <div key={uid} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px',
                        borderBottom: idx < rotationOrder.length - 1 ? '1px solid #F7F8FA' : 'none',
                      }}>
                        <span style={{
                          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                          fontSize: 14, color: '#9CA3AF', width: 20,
                        }}>
                          {idx + 1}
                        </span>
                        <MemberAvatar member={member} size={36} />
                        <p style={{ flex: 1, fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: 14, color: '#111827', margin: 0 }}>
                          {member.full_name ?? member.email}
                          {member.id === currentUserId && (
                            <span style={{ fontSize: 11, color: '#FF6B2B', marginLeft: 6, fontWeight: 700 }}>(you)</span>
                          )}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button
                            type="button" onClick={() => moveUp(idx)}
                            disabled={idx === 0}
                            style={{
                              width: 28, height: 24, borderRadius: 6, border: 'none',
                              background: idx === 0 ? '#F9FAFB' : '#F3F4F6',
                              color: idx === 0 ? '#D1D5DB' : '#6B7280',
                              cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12,
                            }}
                          >▲</button>
                          <button
                            type="button" onClick={() => moveDown(idx)}
                            disabled={idx === rotationOrder.length - 1}
                            style={{
                              width: 28, height: 24, borderRadius: 6, border: 'none',
                              background: idx === rotationOrder.length - 1 ? '#F9FAFB' : '#F3F4F6',
                              color: idx === rotationOrder.length - 1 ? '#D1D5DB' : '#6B7280',
                              cursor: idx === rotationOrder.length - 1 ? 'default' : 'pointer', fontSize: 12,
                            }}
                          >▼</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Single assignee */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Unassigned option */}
                  <button
                    type="button"
                    onClick={() => setAssignedTo(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: assignedTo === null ? '#FFF3EE' : '#fff',
                      border: `2px solid ${assignedTo === null ? '#FF6B2B' : '#F0F0F0'}`,
                      borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>👥</div>
                    <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: 14, color: '#374151', margin: 0 }}>
                      Unassigned
                    </p>
                  </button>

                  {members.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setAssignedTo(member.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: assignedTo === member.id ? '#FFF3EE' : '#fff',
                        border: `2px solid ${assignedTo === member.id ? '#FF6B2B' : '#F0F0F0'}`,
                        borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                      }}
                    >
                      <MemberAvatar member={member} size={36} />
                      <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: 14, color: '#111827', margin: 0 }}>
                        {member.full_name ?? member.email}
                        {member.id === currentUserId && (
                          <span style={{ fontSize: 11, color: '#FF6B2B', marginLeft: 6, fontWeight: 700 }}>(you)</span>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <StepButtons
                  step={step} totalSteps={totalSteps}
                  canNext
                  onBack={() => setStep(s => s - 1)}
                  onNext={() => setStep(s => s + 1)}
                />
              </div>
            </div>
          )}

          {/* ── Step 4: Judgment ─────────────────────────────────────────── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 800, fontSize: 20, color: '#111827', margin: '0 0 4px' }}>
                Judgment system
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px' }}>
                How should completion be verified?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {JUDGMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => !opt.disabled && setJudgment(opt.id)}
                    disabled={opt.disabled}
                    style={{
                      position: 'relative', textAlign: 'left',
                      background: judgment === opt.id ? '#FFF3EE' : opt.disabled ? '#FAFAFA' : '#fff',
                      border: `2px solid ${judgment === opt.id ? '#FF6B2B' : '#F0F0F0'}`,
                      borderRadius: 16, padding: '16px', cursor: opt.disabled ? 'default' : 'pointer',
                      opacity: opt.disabled ? 0.65 : 1,
                      transition: 'all 0.15s',
                      boxShadow: judgment === opt.id ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                    }}
                  >
                    {opt.disabled && (
                      <span style={{
                        position: 'absolute', top: 12, right: 12,
                        fontSize: 10, fontWeight: 700, color: '#6B7280',
                        background: '#F3F4F6', borderRadius: 99, padding: '2px 8px',
                      }}>
                        Coming Soon
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.icon}</span>
                      <div>
                        <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15, color: '#111827', margin: '0 0 3px' }}>
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

              {/* Review summary */}
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #F0F0F0',
                padding: '16px', marginBottom: 20,
              }}>
                <p style={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px' }}>
                  Summary
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SummaryRow label="Chore" value={choreName} />
                  <SummaryRow label="Points" value={`${points} pts`} />
                  <SummaryRow label="Frequency" value={frequency} />
                  {dueDate && <SummaryRow label="Due" value={dueDate} />}
                  <SummaryRow
                    label="Assigned to"
                    value={
                      rotateEnabled
                        ? 'Rotating'
                        : assignedTo
                        ? (members.find(m => m.id === assignedTo)?.full_name ?? 'Unknown')
                        : 'Unassigned'
                    }
                  />
                  <SummaryRow label="Judgment" value={JUDGMENT_OPTIONS.find(o => o.id === judgment)?.title ?? ''} />
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
                  padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626',
                }}>
                  {error}
                </div>
              )}

              <StepButtons
                step={step} totalSteps={totalSteps}
                canNext={!submitting}
                onBack={() => setStep(s => s - 1)}
                onNext={handleCreate}
                nextLabel={submitting ? 'Creating…' : 'Create Chore'}
                nextColor="#10B981"
              />
            </div>
          )}
        </main>

        {!embedded && <BottomNav />}
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header() {
  return (
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
        ✨ Custom Chores
      </span>
    </header>
  )
}

function MemberAvatar({ member, size }: { member: UserRow; size: number }) {
  const name = member.full_name ?? member.email ?? ''
  const inits = initials(name)
  if (member.avatar_url?.startsWith('emoji:')) {
    const emoji = member.avatar_url.slice(6)
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: '#6366f1', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42,
      }}>
        {emoji}
      </div>
    )
  }
  if (member.avatar_url) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <Image src={member.avatar_url} alt={name} width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#6366f1', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: '#fff',
    }}>
      {inits}
    </div>
  )
}

function StepButtons({
  step, totalSteps, canNext, onBack, onNext, nextLabel, nextColor,
}: {
  step:       number
  totalSteps: number
  canNext:    boolean
  onBack:     () => void
  onNext:     () => void
  nextLabel?: string
  nextColor?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {step > 1 && (
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1, padding: '14px', borderRadius: 14,
            background: '#F3F4F6', border: 'none', cursor: 'pointer',
            fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 14, color: '#6B7280',
          }}
        >
          ← Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        style={{
          flex: step === 1 ? 1 : 2, padding: '14px', borderRadius: 14,
          background: canNext ? (nextColor ?? '#FF6B2B') : '#E5E7EB',
          border: 'none', cursor: canNext ? 'pointer' : 'default',
          fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 14,
          color: canNext ? '#fff' : '#9CA3AF',
          boxShadow: canNext ? `0 4px 14px rgba(255,107,43,0.3)` : 'none',
          transition: 'all 0.15s',
        }}
      >
        {nextLabel ?? (step === totalSteps ? 'Create Chore' : 'Next →')}
      </button>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', textAlign: 'right', textTransform: 'capitalize' as const }}>
        {value}
      </span>
    </div>
  )
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6,
  fontFamily: '"Nunito", sans-serif', fontWeight: 700,
  fontSize: 13, color: '#374151',
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '2px solid #E5E7EB', borderRadius: 12,
  padding: '11px 14px', fontSize: 14, color: '#111827',
  fontFamily: '"Nunito", sans-serif', outline: 'none',
  background: '#fff',
}
