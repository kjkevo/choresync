import GoBackButton from './_components/GoBackButton'

export default function NotFound() {
  return (
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
        fontSize: 28, marginBottom: 24,
        boxShadow: '0 8px 24px rgba(255,107,43,0.3)',
      }}>
        🧹
      </div>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 800,
        fontSize: 18, color: '#111827', marginBottom: 32, letterSpacing: '-0.3px',
      }}>
        CS ChoreSync
      </div>

      {/* 404 number */}
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 900,
        fontSize: 96, color: '#FF6B2B', lineHeight: 1,
        marginBottom: 16, letterSpacing: '-4px',
      }}>
        404
      </div>

      {/* Heading */}
      <h1 style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 700,
        fontSize: 28, color: '#111827', margin: '0 0 12px',
      }}>
        Page not found
      </h1>

      {/* Message */}
      <p style={{
        fontSize: 15, color: '#6B7280', margin: '0 0 40px',
        maxWidth: 380, lineHeight: 1.6,
      }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
        <GoBackButton />
      </div>
    </div>
  )
}
