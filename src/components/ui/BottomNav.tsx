'use client'

import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Home',     icon: <HomeIcon />     },
  { href: '/leaderboard', label: 'Rankings',  icon: <TrophyIcon />   },
  { href: '/custom',      label: 'Custom',    icon: <SparkleIcon />  },
  { href: '/social',      label: 'Chat',      icon: <ChatIcon />     },
  { href: '/profile',     label: 'Profile',   icon: <PersonIcon />   },
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

// ─── SVG Icons (16px) ─────────────────────────────────────────────────────────

const IC = {
  width: 20, height: 20, fill: 'none',
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

function TrophyIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M8 21h8M12 17v4" />
      <path d="M5 4h14v7a7 7 0 01-14 0V4z" />
      <path d="M5 6H3a2 2 0 000 4l2 1" />
      <path d="M19 6h2a2 2 0 010 4l-2 1" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg {...IC} viewBox="0 0 24 24">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
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
