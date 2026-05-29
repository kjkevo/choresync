'use client'

import { useRouter } from 'next/navigation'

export default function BackLink({ fallback = '/login' }: { fallback?: string }) {
  const router = useRouter()

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: '#FF6B2B',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        marginBottom: 32,
        fontFamily: 'inherit',
        textDecoration: 'none',
      }}
    >
      ← Back
    </button>
  )
}
