'use client'

// Self-contained 404 page — no external imports that could fail at build time

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&family=Nunito:wght@400;600;700&display=swap');
      `}</style>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FA',
        fontFamily: "'Nunito', 'Inter', sans-serif",
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #FF6B2B, #ffb347)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 20,
          boxShadow: '0 8px 24px rgba(255,107,43,0.28)',
        }}>
          🧹
        </div>
        <div style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 18, color: '#111827', marginBottom: 36, letterSpacing: '-0.3px',
        }}>
          ChoreSync
        </div>

        {/* 404 */}
        <div style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 900,
          fontSize: 96, color: '#FF6B2B', lineHeight: 1,
          marginBottom: 16, letterSpacing: '-4px',
        }}>
          404
        </div>

        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 26, color: '#111827', margin: '0 0 12px',
        }}>
          Page not found
        </h1>

        <p style={{
          fontSize: 15, color: '#6B7280', margin: '0 0 40px',
          maxWidth: 380, lineHeight: 1.6,
        }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Use the buttons below to find your way back.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="/dashboard"
            style={{
              background: '#FF6B2B',
              color: '#fff',
              borderRadius: 14,
              padding: '13px 24px',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(255,107,43,0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Go to Dashboard
          </a>
          <button
            onClick={() => window.history.back()}
            style={{
              background: '#fff',
              color: '#374151',
              borderRadius: 14,
              padding: '13px 24px',
              fontSize: 15,
              fontWeight: 700,
              border: '1.5px solid #E5E7EB',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </>
  )
}
