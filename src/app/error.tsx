'use client'

// Route-level error boundary.
// Next.js renders this whenever a Server Component in any route throws
// an unhandled exception. Must be a Client Component (the 'use client'
// directive above is required by the framework).

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error:  Error & { digest?: string }
  reset:  () => void
}) {
  useEffect(() => {
    // Log to your error tracking service here if needed
    console.error('[ChoreSync error boundary]', error)
  }, [error])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Nunito:wght@400;600;700&display=swap');
      `}</style>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FA',
        fontFamily: "'Nunito', sans-serif",
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #FF6B2B, #ffb347)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 16,
          boxShadow: '0 8px 24px rgba(255,107,43,0.28)',
        }}>
          🧹
        </div>
        <div style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 18, color: '#111827', marginBottom: 32, letterSpacing: '-0.3px',
        }}>
          ChoreSync
        </div>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#FFF3EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, marginBottom: 20,
        }}>
          ⚠️
        </div>

        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 800,
          fontSize: 24, color: '#111827', margin: '0 0 10px',
        }}>
          Something went wrong
        </h1>

        <p style={{
          fontSize: 15, color: '#6B7280', margin: '0 0 8px',
          maxWidth: 380, lineHeight: 1.6,
        }}>
          We hit an unexpected error. It&apos;s been logged and we&apos;ll look into it.
        </p>

        {/* Show digest in production so users can report it */}
        {error.digest && (
          <p style={{
            fontSize: 12, color: '#9CA3AF',
            fontFamily: 'monospace',
            background: '#F3F4F6', borderRadius: 6,
            padding: '4px 10px', margin: '0 0 32px',
            display: 'inline-block',
          }}>
            Error ID: {error.digest}
          </p>
        )}
        {!error.digest && <div style={{ marginBottom: 32 }} />}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background: '#FF6B2B',
              color: '#fff',
              borderRadius: 14,
              padding: '13px 28px',
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              background: '#fff',
              color: '#374151',
              borderRadius: 14,
              padding: '13px 28px',
              fontSize: 15,
              fontWeight: 700,
              border: '1.5px solid #E5E7EB',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </>
  )
}
