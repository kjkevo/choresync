'use client'

// Global error boundary — catches errors thrown inside the root layout itself
// (e.g. a crash in RootLayout before any route renders).
// Must include its own <html> and <body> tags because the layout may be broken.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error:  Error & { digest?: string }
  reset:  () => void
}) {
  useEffect(() => {
    console.error('[ChoreSync global error]', error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong | ChoreSync</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Nunito:wght@400;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #F7F8FA; }
        `}</style>
      </head>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Nunito', sans-serif",
          padding: '24px',
          textAlign: 'center',
        }}>
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
            fontSize: 18, color: '#111827', marginBottom: 32,
          }}>
            ChoreSync
          </div>

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
            fontSize: 24, color: '#111827', marginBottom: 10,
          }}>
            Something went wrong
          </h1>

          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 380, lineHeight: 1.6, marginBottom: 32 }}>
            ChoreSync hit an unexpected error. Try refreshing — if the problem persists, come back in a moment.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: '#FF6B2B', color: '#fff',
                borderRadius: 14, padding: '13px 28px',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: '#fff', color: '#374151',
                borderRadius: 14, padding: '13px 28px',
                fontSize: 15, fontWeight: 700,
                border: '1.5px solid #E5E7EB',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
