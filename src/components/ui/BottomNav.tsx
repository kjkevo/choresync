'use client'

import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',    icon: <HomeIcon />    },
  { href: '/social',    label: 'Chat',    icon: <ChatIcon />    },
  { href: '/rewards',   label: 'Rewards', icon: <RewardsIcon /> },
  { href: '/profile',   label: 'Profile', icon: <PersonIcon />  },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#fff', borderTop: '1px solid #F0F0F0',
      display: 'flex', alignItems: 'stretch',
      height: 68,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, textDecoration: 'none',
              color: active ? '#FF6B2B' : '#9CA3AF',
              padding: '4px 0 6px',
              transition: 'color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
              {item.icon}
            </div>
            <span style={{
              fontSize: 10,
              fontFamily: '"Nunito", sans-serif',
              fontWeight: active ? 800 : 600,
              letterSpacing: '0.01em',
            }}>
              {item.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IC = {
  width: 22, height: 22, fill: 'none',
  stroke: 'currentColor', strokeWidth: '2.2' as const,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function HomeIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function ChoresIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function RewardsIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}
