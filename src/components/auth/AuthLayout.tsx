import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

/**
 * Shared shell for all auth pages.
 * Bold gradient background with floating accents and a clean centered card.
 */
export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 flex flex-col items-center justify-center px-4 py-12">

      {/* Decorative blobs */}
      <div aria-hidden className="pointer-events-none select-none">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-pink-500/30 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[380px] w-[380px] rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-[320px] w-[320px] rounded-full bg-violet-400/20 blur-3xl" />
      </div>

      {/* Floating emoji accents */}
      <div aria-hidden className="pointer-events-none select-none">
        <span className="absolute top-8 left-[8%] text-4xl opacity-60 drop-shadow" style={{ rotate: '-15deg' }}>🧹</span>
        <span className="absolute top-16 right-[10%] text-3xl opacity-50 drop-shadow" style={{ rotate: '12deg' }}>✨</span>
        <span className="absolute bottom-12 left-[12%] text-3xl opacity-50 drop-shadow" style={{ rotate: '8deg' }}>🏡</span>
        <span className="absolute bottom-20 right-[8%] text-4xl opacity-60 drop-shadow" style={{ rotate: '-10deg' }}>🌟</span>
        <span className="absolute top-1/2 left-[4%] text-2xl opacity-40 drop-shadow" style={{ rotate: '20deg' }}>🫧</span>
        <span className="absolute top-1/3 right-[4%] text-2xl opacity-40 drop-shadow" style={{ rotate: '-8deg' }}>🪴</span>
      </div>

      {/* Logo */}
      <Link
        href="/"
        className="relative z-10 mb-8 flex items-center gap-3 group"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-lg backdrop-blur-sm ring-1 ring-white/30 group-hover:bg-white/30 transition">
          🏠
        </span>
        <span className="text-3xl font-extrabold tracking-tight text-white drop-shadow">
          ChoreSync
        </span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl bg-white/95 shadow-2xl backdrop-blur-md ring-1 ring-white/60 px-8 py-9">

          {/* Title */}
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>

          {children}
        </div>

        {/* Card glow */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-pink-400/20 via-indigo-400/20 to-sky-400/20 blur-xl -z-10" />
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-white/50">
        © {new Date().getFullYear()} ChoreSync — keep your home in sync
      </p>
    </div>
  )
}
