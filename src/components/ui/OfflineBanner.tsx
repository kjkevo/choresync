'use client'
import { useEffect, useState } from 'react'
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { readQueue } = useOfflineQueue()

  useEffect(() => {
    const update = () => {
      setIsOffline(!navigator.onLine)
      setPendingCount(readQueue().length)
    }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [readQueue])

  if (!isOffline && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isOffline ? 'You are offline' : `${pendingCount} chores pending sync`}
      style={{
        position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div style={{
        background: isOffline ? '#1e293b' : '#059669',
        color: '#fff',
        borderRadius: 24,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        pointerEvents: 'auto',
      }}>
        <span>{isOffline ? '📡' : '🔄'}</span>
        {isOffline
          ? `You're offline${pendingCount > 0 ? ` · ${pendingCount} queued` : ''}`
          : `Syncing ${pendingCount} chore${pendingCount !== 1 ? 's' : ''}…`}
      </div>
    </div>
  )
}
