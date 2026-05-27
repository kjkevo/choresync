'use client'
// Manages a queue of pending chore completions when offline.
// Persists to localStorage. Flushes when online or when SW sends FLUSH_OFFLINE_QUEUE.

import { useEffect, useCallback } from 'react'
import { completeChore } from '@/lib/actions/chores'

const QUEUE_KEY = 'cs-offline-queue'

export interface PendingCompletion {
  choreId:   string
  choreName: string
  queuedAt:  string
}

function readQueue(): PendingCompletion[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}
function writeQueue(q: PendingCompletion[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function useOfflineQueue() {
  const flush = useCallback(async () => {
    const queue = readQueue()
    if (queue.length === 0) return
    const remaining: PendingCompletion[] = []
    for (const item of queue) {
      try {
        const result = await completeChore(item.choreId)
        if (result?.error) remaining.push(item)
      } catch {
        remaining.push(item)
      }
    }
    writeQueue(remaining)
  }, [])

  useEffect(() => {
    // Flush on reconnect
    window.addEventListener('online', flush)
    // Flush on SW message
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'FLUSH_OFFLINE_QUEUE') flush()
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    // Flush immediately if we're online
    if (navigator.onLine) flush()
    return () => {
      window.removeEventListener('online', flush)
      navigator.serviceWorker?.removeEventListener('message', handler)
    }
  }, [flush])

  function enqueue(item: PendingCompletion) {
    const q = readQueue()
    if (!q.find(x => x.choreId === item.choreId)) {
      writeQueue([...q, item])
    }
  }

  function dequeue(choreId: string) {
    writeQueue(readQueue().filter(x => x.choreId !== choreId))
  }

  return { enqueue, dequeue, flush, readQueue }
}
