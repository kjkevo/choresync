'use client'

export default function GoBackButton() {
  return (
    <button
      onClick={() => history.back()}
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
  )
}
