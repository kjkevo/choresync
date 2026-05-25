'use client'

import { useState, useEffect, useCallback } from 'react'

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

/**
 * Hook for managing Web Push subscription state.
 * Returns the current status and helpers to subscribe/unsubscribe.
 */
export function usePushSubscription(householdId: string) {
  const [status, setStatus] = useState<PushStatus>('default')
  const [loading, setLoading] = useState(false)

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  // Derive the current status on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'denied') { setStatus('denied'); return }

    navigator.serviceWorker.ready.then(async reg => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) setStatus('subscribed')
      else setStatus(perm === 'granted' ? 'granted' : 'default')
    })
  }, [])

  const subscribe = useCallback(async (): Promise<{ error?: string }> => {
    if (!publicKey) return { error: 'VAPID key not configured' }
    setLoading(true)
    try {
      // Register service worker if needed
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return { error: 'Permission denied' } }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })

      const res = await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON(), householdId }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error ?? 'Subscribe failed' }
      }

      setStatus('subscribed')
      return {}
    } catch (err) {
      console.error('[push] subscribe error', err)
      return { error: String(err) }
    } finally {
      setLoading(false)
    }
  }, [publicKey, householdId])

  const unsubscribe = useCallback(async (): Promise<{ error?: string }> => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('default')
      return {}
    } catch (err) {
      return { error: String(err) }
    } finally {
      setLoading(false)
    }
  }, [])

  return { status, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
