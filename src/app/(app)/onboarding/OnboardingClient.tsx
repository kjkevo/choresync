'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createHousehold, joinHousehold } from '@/lib/actions/household'
import { createChore } from '@/lib/actions/chores'

// ─── Fonts ────────────────────────────────────────────────────────────────────

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
`

// ─── Constants ────────────────────────────────────────────────────────────────

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

type TemplateItem = {
  name: string
  emoji: string
  category: string
  defaultPoints: number
}

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

type ChoreConfig = {
  template: TemplateItem | null   // null = custom
  name: string
  points: number
  dueDate: string
  frequency: Frequency
  category: string
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step =
  | 'choice'
  | 'join'
  | 'create-name'
  | 'create-template'
  | 'create-configure'
  | 'create-assign'
  | 'create-judgment'
  | 'create-success'

// ─── Props ────────────────────────────────────────────────────────────────────

interface OnboardingClientProps {
  displayName: string
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

const CREATE_STEPS: Step[] = [
  'create-name',
  'create-template',
  'create-configure',
  'create-assign',
  'create-judgment',
]

const CREATE_STEP_LABELS = ['Name', 'Templates', 'Configure', 'Assign', 'Judgment']

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingClient({ displayName }: OnboardingClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep]              = useState<Step>('choice')
  const [error, setError]            = useState<string | null>(null)

  // Household created
  const [household, setHousehold] = useState<{ id: string; name: string; invite_code: string } | null>(null)

  // Template selection (multi-select)
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateItem[]>([])
  const [customSelected, setCustomSelected]       = useState(false)

  // Chore configs (one per selected template + one if custom)
  const [choreConfigs, setChoreConfigs] = useState<ChoreConfig[]>([])
  const [expandedIdx, setExpandedIdx]   = useState<number>(0)

  // Assign + judgment
  const [assignTo, setAssignTo]   = useState<'me' | 'unassigned'>('me')
  const [judgment, setJudgment]   = useState<JudgmentType>('self')

  // Join flow
  const [joinCode, setJoinCode] = useState('')

  // Success
  const [copied, setCopied] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function clearError() { setError(null) }

  function buildChoreConfigs(templates: TemplateItem[], withCustom: boolean): ChoreConfig[] {
    const configs: ChoreConfig[] = templates.map(t => ({
      template: t,
      name: t.name,
      points: t.defaultPoints,
      dueDate: '',
      frequency: 'weekly' as Frequency,
      category: t.category,
    }))
    if (withCustom) {
      configs.push({
        template: null,
        name: '',
        points: 10,
        dueDate: '',
        frequency: 'one-time' as Frequency,
        category: 'general',
      })
    }
    return configs
  }

  function toggleTemplate(t: TemplateItem) {
    setSelectedTemplates(prev => {
      const exists = prev.some(x => x.name === t.name)
      return exists ? prev.filter(x => x.name !== t.name) : [...prev, t]
    })
  }

  function isTemplateSelected(t: TemplateItem) {
    return selectedTemplates.some(x => x.name === t.name)
  }

  function updateChoreConfig(idx: number, patch: Partial<ChoreConfig>) {
    setChoreConfigs(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  function advanceToTemplate() {
    clearError()
    setStep('create-template')
  }

  function advanceToConfigure() {
    if (selectedTemplates.length === 0 && !customSelected) {
      setError('Please select at least one chore template.')
      return
    }
    clearError()
    const configs = buildChoreConfigs(selectedTemplates, customSelected)
    setChoreConfigs(configs)
    setExpandedIdx(0)
    setStep('create-configure')
  }

  function advanceToAssign() {
    const allNamed = choreConfigs.every(c => c.name.trim().length > 0)
    if (!allNamed) {
      setError('Please give every chore a name.')
      return
    }
    clearError()
    setStep('create-assign')
  }

  // ── Join handler ─────────────────────────────────────────────────────────────

  function handleJoinSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearError()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await joinHousehold(fd)
      if (result?.error) setError(result.error)
      else router.push('/dashboard')
    })
  }

  function handleCodeInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setJoinCode(val)
  }

  // ── Create household handler ──────────────────────────────────────────────────

  function handleCreateHousehold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearError()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createHousehold(fd)
      if (result?.error) {
        setError(result.error)
      } else if (result?.household) {
        setHousehold(result.household as { id: string; name: string; invite_code: string })
        advanceToTemplate()
      }
    })
  }

  // ── Final create chores handler ───────────────────────────────────────────────

  function handleFinish() {
    if (!household) return
    clearError()
    startTransition(async () => {
      for (const cfg of choreConfigs) {
        const fd = new FormData()
        fd.append('household_id', household.id)
        fd.append('name', cfg.name.trim())
        fd.append('points', String(cfg.points))
        fd.append('frequency', cfg.frequency)
        fd.append('category', cfg.category)
        if (cfg.dueDate) fd.append('due_date', cfg.dueDate)
        if (assignTo === 'me') fd.append('assigned_to', '__me__')
        if (judgment === 'ai') fd.append('require_photo', 'true')
        const result = await createChore(fd)
        if (result?.error) {
          setError(result.error)
          return
        }
      }
      setStep('create-success')
    })
  }

  async function copyCode() {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Progress indicator ────────────────────────────────────────────────────────

  const createStepIdx = CREATE_STEPS.indexOf(step)
  const showProgress  = createStepIdx !== -1

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{FONTS}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #FF6B2B 0%, #ff8f5e 50%, #ffb347 100%)',
        fontFamily: '"Nunito", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 40px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Poppins", sans-serif', fontWeight: 800,
            fontSize: 18, color: '#FF6B2B', flexShrink: 0,
          }}>
            CS
          </div>
          <span style={{
            fontFamily: '"Poppins", sans-serif', fontWeight: 800,
            fontSize: 22, color: '#fff', letterSpacing: '-0.3px',
          }}>
            ChoreSync
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 480,
          background: '#fff', borderRadius: 24,
          padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}>
          {/* Progress bar for create steps */}
          {showProgress && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                {CREATE_STEP_LABELS.map((label, i) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: createStepIdx > i ? '#FF6B2B' : createStepIdx === i ? '#FF6B2B' : '#E5E7EB',
                      color: createStepIdx >= i ? '#fff' : '#9CA3AF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 11,
                      marginBottom: 3,
                    }}>
                      {createStepIdx > i ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      color: createStepIdx === i ? '#FF6B2B' : '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 4, background: '#E5E7EB', borderRadius: 99 }}>
                <div style={{
                  height: '100%', background: '#FF6B2B', borderRadius: 99,
                  width: `${((createStepIdx + 1) / CREATE_STEPS.length) * 100}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{
              background: '#fef2f2', color: '#dc2626',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 13, fontWeight: 600,
              marginBottom: 16, lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          {/* ── STEP: choice ─────────────────────────────────────────────── */}
          {step === 'choice' && (
            <div>
              <p style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                fontSize: 15, color: '#FF6B2B', margin: '0 0 4px', textAlign: 'center',
              }}>
                Hey, {displayName}!
              </p>
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 22, color: '#111827', margin: '0 0 6px', textAlign: 'center',
              }}>
                Let&apos;s get you set up
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px', textAlign: 'center' }}>
                Join an existing household or create your own.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Create */}
                <button
                  type="button"
                  onClick={() => { clearError(); setStep('create-name') }}
                  style={{
                    background: '#FF6B2B', border: 'none', borderRadius: 18,
                    padding: '20px 20px', cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 6px 20px rgba(255,107,43,0.35)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🏡</div>
                  <p style={{
                    fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                    fontSize: 16, color: '#fff', margin: '0 0 3px',
                  }}>
                    Create a Household
                  </p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', margin: 0 }}>
                    Set up chores &amp; invite your crew
                  </p>
                </button>

                {/* Join */}
                <button
                  type="button"
                  onClick={() => { clearError(); setStep('join') }}
                  style={{
                    background: '#fff', border: '2px solid #E5E7EB', borderRadius: 18,
                    padding: '20px 20px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🔑</div>
                  <p style={{
                    fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                    fontSize: 16, color: '#111827', margin: '0 0 3px',
                  }}>
                    Join a Household
                  </p>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                    Enter your housemate&apos;s invite code
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: join ───────────────────────────────────────────────── */}
          {step === 'join' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('choice') }} label="Back to choice" />
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
                <h2 style={{
                  fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                  fontSize: 20, color: '#111827', margin: '0 0 6px',
                }}>
                  Join a Household
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  Enter the 6-character code your housemate shared
                </p>
              </div>

              <form onSubmit={handleJoinSubmit}>
                <input type="hidden" name="code" value={joinCode} />
                <div style={{ marginBottom: 20 }}>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={handleCodeInput}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={6}
                    style={{
                      ...inputStyle,
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: 32,
                      fontWeight: 800,
                      letterSpacing: '0.45em',
                      padding: '16px 14px',
                      border: '2px solid #E5E7EB',
                      borderRadius: 16,
                      color: '#FF6B2B',
                    }}
                  />
                  <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                    Letters and numbers only — not case-sensitive.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isPending || joinCode.length < 6}
                  style={primaryBtnStyle(isPending || joinCode.length < 6)}
                >
                  {isPending ? 'Joining…' : 'Join Household →'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP: create-name ────────────────────────────────────────── */}
          {step === 'create-name' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('choice') }} label="Back to choice" />
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏡</div>
                <h2 style={{
                  fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                  fontSize: 20, color: '#111827', margin: '0 0 6px',
                }}>
                  Name your household
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  This is how your housemates will identify your home.
                </p>
              </div>

              <form onSubmit={handleCreateHousehold}>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Household name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    placeholder='e.g. "The Smith House" or "Apt 4B"'
                    autoFocus
                    style={{ ...inputStyle, textAlign: 'center', fontSize: 16, fontWeight: 700 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  style={primaryBtnStyle(isPending)}
                >
                  {isPending ? 'Creating…' : 'Continue →'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP: create-template ────────────────────────────────────── */}
          {step === 'create-template' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('create-name') }} label="Back" />
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 20, color: '#111827', margin: '0 0 4px',
              }}>
                Choose chores
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                Select all that apply — you can add more later.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {TEMPLATES.map((t, idx) => {
                  const sel = isTemplateSelected(t)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleTemplate(t)}
                      style={{
                        background: '#fff',
                        border: `2px solid ${sel ? '#FF6B2B' : '#F0F0F0'}`,
                        borderRadius: 16, padding: '14px 10px', cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: sel ? '0 0 0 3px rgba(255,107,43,0.15)' : 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 5 }}>{t.emoji}</div>
                      <p style={{
                        fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                        fontSize: 11, color: '#111827', margin: '0 0 3px',
                      }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>
                        🏆 {t.defaultPoints} pts
                      </p>
                    </button>
                  )
                })}

                {/* Custom card */}
                <button
                  type="button"
                  onClick={() => setCustomSelected(v => !v)}
                  style={{
                    background: customSelected ? '#FFF3EE' : '#fff',
                    border: `2px solid ${customSelected ? '#FF6B2B' : '#F0F0F0'}`,
                    borderRadius: 16, padding: '14px 10px', cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: customSelected ? '0 0 0 3px rgba(255,107,43,0.15)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 5 }}>✏️</div>
                  <p style={{
                    fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                    fontSize: 11, color: '#111827', margin: '0 0 3px',
                  }}>
                    Custom
                  </p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Write your own</p>
                </button>
              </div>

              <button
                type="button"
                onClick={advanceToConfigure}
                disabled={selectedTemplates.length === 0 && !customSelected}
                style={primaryBtnStyle(selectedTemplates.length === 0 && !customSelected)}
              >
                {selectedTemplates.length + (customSelected ? 1 : 0) > 0
                  ? `Continue with ${selectedTemplates.length + (customSelected ? 1 : 0)} chore${selectedTemplates.length + (customSelected ? 1 : 0) !== 1 ? 's' : ''} →`
                  : 'Select at least one chore'}
              </button>
            </div>
          )}

          {/* ── STEP: create-configure ───────────────────────────────────── */}
          {step === 'create-configure' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('create-template') }} label="Back" />
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 20, color: '#111827', margin: '0 0 4px',
              }}>
                Configure chores
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                Set the details for each chore.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {choreConfigs.map((cfg, idx) => {
                  const isOpen = expandedIdx === idx
                  return (
                    <div key={idx} style={{
                      border: `2px solid ${isOpen ? '#FF6B2B' : '#F0F0F0'}`,
                      borderRadius: 16, overflow: 'hidden',
                      boxShadow: isOpen ? '0 0 0 3px rgba(255,107,43,0.1)' : 'none',
                      transition: 'border-color 0.15s',
                    }}>
                      {/* Accordion header */}
                      <button
                        type="button"
                        onClick={() => setExpandedIdx(isOpen ? -1 : idx)}
                        style={{
                          width: '100%', textAlign: 'left',
                          background: isOpen ? '#FFF8F5' : '#fff',
                          border: 'none', cursor: 'pointer',
                          padding: '12px 14px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>
                            {cfg.template?.emoji ?? '✏️'}
                          </span>
                          <span style={{
                            fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                            fontSize: 14, color: '#111827',
                          }}>
                            {cfg.name || 'Custom chore'}
                          </span>
                        </div>
                        <span style={{ fontSize: 18, color: '#9CA3AF' }}>{isOpen ? '▲' : '▼'}</span>
                      </button>

                      {/* Accordion body */}
                      {isOpen && (
                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Chore name</label>
                            <input
                              type="text"
                              value={cfg.name}
                              onChange={e => updateChoreConfig(idx, { name: e.target.value })}
                              placeholder="e.g. Sweep the kitchen floor"
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Points</label>
                            <input
                              type="number"
                              min={1} max={100}
                              value={cfg.points}
                              onChange={e => updateChoreConfig(idx, { points: Number(e.target.value) })}
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Due date (optional)</label>
                            <input
                              type="date"
                              value={cfg.dueDate}
                              onChange={e => updateChoreConfig(idx, { dueDate: e.target.value })}
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Frequency</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {FREQUENCIES.map(f => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => updateChoreConfig(idx, { frequency: f })}
                                  style={{
                                    padding: '7px 12px', borderRadius: 99,
                                    border: `2px solid ${cfg.frequency === f ? '#FF6B2B' : '#E5E7EB'}`,
                                    background: cfg.frequency === f ? '#FFF3EE' : '#fff',
                                    color: cfg.frequency === f ? '#FF6B2B' : '#6B7280',
                                    fontFamily: '"Nunito", sans-serif', fontWeight: 700, fontSize: 12,
                                    cursor: 'pointer', textTransform: 'capitalize' as const,
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={advanceToAssign}
                style={primaryBtnStyle(false)}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP: create-assign ──────────────────────────────────────── */}
          {step === 'create-assign' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('create-configure') }} label="Back" />
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 20, color: '#111827', margin: '0 0 4px',
              }}>
                Assign chores
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                Who should be responsible for these chores?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {/* Assign to me */}
                <button
                  type="button"
                  onClick={() => setAssignTo('me')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: assignTo === 'me' ? '#FFF3EE' : '#fff',
                    border: `2px solid ${assignTo === 'me' ? '#FF6B2B' : '#F0F0F0'}`,
                    borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    boxShadow: assignTo === 'me' ? '0 0 0 3px rgba(255,107,43,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: '#FF6B2B', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    😊
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{
                      fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                      fontSize: 14, color: '#111827', margin: '0 0 2px',
                    }}>
                      Assign to me <span style={{ color: '#FF6B2B', fontSize: 12 }}>(You)</span>
                    </p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                      You&apos;ll be responsible for these chores
                    </p>
                  </div>
                </button>

                {/* Leave unassigned */}
                <button
                  type="button"
                  onClick={() => setAssignTo('unassigned')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: assignTo === 'unassigned' ? '#FFF3EE' : '#fff',
                    border: `2px solid ${assignTo === 'unassigned' ? '#FF6B2B' : '#F0F0F0'}`,
                    borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    boxShadow: assignTo === 'unassigned' ? '0 0 0 3px rgba(255,107,43,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: '#F3F4F6', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    👥
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{
                      fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                      fontSize: 14, color: '#111827', margin: '0 0 2px',
                    }}>
                      Leave unassigned
                    </p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                      Assign after inviting members
                    </p>
                  </div>
                </button>

                {/* Rotation disabled notice */}
                <div style={{
                  background: '#F9FAFB', border: '2px solid #E5E7EB',
                  borderRadius: 14, padding: '14px 16px', opacity: 0.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: '#E5E7EB', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      🔄
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{
                        fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                        fontSize: 14, color: '#6B7280', margin: '0 0 2px',
                      }}>
                        Rotate after completion
                      </p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                        Add members first to enable rotation
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div style={{
                background: '#FFF8F0', borderRadius: 12, padding: '10px 14px',
                fontSize: 12, color: '#92400E', marginBottom: 20,
              }}>
                💡 You can reassign chores anytime after inviting housemates.
              </div>

              <button
                type="button"
                onClick={() => { clearError(); setStep('create-judgment') }}
                style={primaryBtnStyle(false)}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP: create-judgment ────────────────────────────────────── */}
          {step === 'create-judgment' && (
            <div>
              <BackButton onClick={() => { clearError(); setStep('create-assign') }} label="Back" />
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 20, color: '#111827', margin: '0 0 4px',
              }}>
                Judgment system
              </h2>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
                How should chore completion be verified?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
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
                      boxShadow: judgment === opt.id ? '0 0 0 3px rgba(255,107,43,0.12)' : 'none',
                      transition: 'all 0.15s',
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
                        <p style={{
                          fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                          fontSize: 15, color: '#111827', margin: '0 0 3px',
                        }}>
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

              <button
                type="button"
                onClick={handleFinish}
                disabled={isPending}
                style={{
                  ...primaryBtnStyle(isPending),
                  background: isPending ? '#E5E7EB' : '#10B981',
                  boxShadow: isPending ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                }}
              >
                {isPending ? 'Setting up…' : 'Create Household →'}
              </button>
            </div>
          )}

          {/* ── STEP: create-success ─────────────────────────────────────── */}
          {step === 'create-success' && household && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <h2 style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 800,
                fontSize: 22, color: '#111827', margin: '0 0 6px',
              }}>
                Your household is ready!
              </h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>
                Share your invite code with housemates so they can join.
              </p>

              {/* Invite code display */}
              <div style={{
                border: '2px dashed #FF6B2B', borderRadius: 18,
                background: '#FFF8F5', padding: '20px 16px', marginBottom: 8,
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: '#FF6B2B',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  margin: '0 0 10px',
                }}>
                  Invite Code
                </p>
                <p style={{
                  fontFamily: 'monospace', fontSize: 40, fontWeight: 900,
                  letterSpacing: '0.35em', color: '#FF6B2B', margin: 0,
                }}>
                  {household.invite_code}
                </p>
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
                Your housemates enter this on their Join screen.
              </p>

              {/* Action buttons */}
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
                    onClick={() =>
                      navigator.share({
                        title: `Join ${household.name} on ChoreSync`,
                        text: `Use invite code ${household.invite_code} to join our household!`,
                      })
                    }
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
                style={primaryBtnStyle(false)}
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: '"Nunito", sans-serif', fontWeight: 700,
        fontSize: 13, color: '#9CA3AF', marginBottom: 16,
      }}
    >
      ← {label}
    </button>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%',
    padding: '14px', borderRadius: 14,
    background: disabled ? '#E5E7EB' : '#FF6B2B',
    border: 'none', cursor: disabled ? 'default' : 'pointer',
    fontFamily: '"Poppins", sans-serif', fontWeight: 700, fontSize: 15,
    color: disabled ? '#9CA3AF' : '#fff',
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(255,107,43,0.3)',
    transition: 'all 0.15s',
  }
}
