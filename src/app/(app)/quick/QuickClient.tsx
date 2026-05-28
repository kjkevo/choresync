'use client'

import { useState, useTransition } from 'react'
import { completeChore } from '@/lib/actions/chores'
import type { ChoreRow } from '@/lib/types/database'

const CATEGORY_EMOJI: Record<string, string> = {
  kitchen:  '🍳',
  bathroom: '🚿',
  bedroom:  '🛏️',
  outdoor:  '🌿',
  laundry:  '👕',
  general:  '🏠',
}

function isOverdue(dueDateIso: string): boolean {
  const today = new Date()
  const due   = new Date(dueDateIso)
  return new Date(due.getFullYear(), due.getMonth(), due.getDate()) <
         new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  chores:      ChoreRow[]
  userId:      string
  householdId: string
}

export default function QuickClient({ chores }: Props) {
  const [done, setDone]       = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function handleComplete(chore: ChoreRow) {
    if (done.has(chore.id)) return
    setDone(prev => new Set([...prev, chore.id]))
    startTransition(async () => {
      await completeChore(chore.id)
    })
  }

  const remaining = chores.filter(c => !done.has(c.id))
  const allDone   = chores.length === 0 || remaining.length === 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '16px',
      maxWidth: '400px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '20px' }}>🧹</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Today</span>
        {!allDone && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px',
            fontWeight: 600,
            background: '#e0e7ff',
            color: '#4338ca',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {remaining.length} left
          </span>
        )}
      </div>

      {/* All done state */}
      {allDone && (
        <div style={{
          textAlign: 'center',
          paddingTop: '60px',
          color: '#16a34a',
          fontSize: '18px',
          fontWeight: 600,
        }}>
          All done!
        </div>
      )}

      {/* Chore list */}
      {!allDone && chores.map(chore => {
        const completed = done.has(chore.id)
        const overdue   = chore.due_date ? isOverdue(chore.due_date) : false
        const emoji     = CATEGORY_EMOJI[chore.category] ?? '🏠'

        return (
          <div
            key={chore.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: completed ? '#f0fdf4' : '#ffffff',
              border: `1px solid ${overdue ? '#fca5a5' : '#e2e8f0'}`,
              borderRadius: '16px',
              padding: '12px',
              marginBottom: '10px',
              opacity: completed ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Checkbox circle */}
            <button
              type="button"
              disabled={completed || isPending}
              onClick={() => handleComplete(chore)}
              aria-label={completed ? 'Done' : 'Mark complete'}
              style={{
                flexShrink: 0,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `2px solid ${completed ? '#22c55e' : overdue ? '#f87171' : '#94a3b8'}`,
                background: completed ? '#22c55e' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: completed ? 'default' : 'pointer',
                fontSize: '18px',
              }}
            >
              {completed ? '✓' : ''}
            </button>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: completed ? '#94a3b8' : '#1e293b',
                  textDecoration: completed ? 'line-through' : 'none',
                }}>
                  {chore.name}
                </span>
                <span style={{ fontSize: '14px' }}>{emoji}</span>
              </div>
              {chore.due_date && (
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  padding: '1px 8px',
                  background: overdue ? '#fee2e2' : '#fef3c7',
                  color:      overdue ? '#dc2626' : '#92400e',
                }}>
                  {overdue ? '⚠️ ' : '📅 '}{formatDate(chore.due_date)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
