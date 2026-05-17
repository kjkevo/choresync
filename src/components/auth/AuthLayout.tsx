import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

/**
 * Auth page shell — split panel on desktop, stacked on mobile.
 * Left: brand panel with gradient + decorative pattern.
 * Right: clean white form area.
 */
export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-600 to-sky-500 p-12">

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Blob accents */}
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-pink-500/30 blur-3xl" />
        <div className="absolute top-24 right-0 h-56 w-56 rounded-full bg-sky-300/25 blur-2xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3 group w-fit">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl font-bold text-white ring-1 ring-white/30 group-hover:bg-white/30 transition">
            C
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">ChoreSync</span>
        </Link>

        {/* Center copy */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold leading-tight text-white">
              Keep your home<br />in perfect sync.
            </h2>
            <p className="text-base text-white/70 leading-relaxed max-w-xs">
              Assign chores, track progress, and celebrate wins — together as a household.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Smart rotation', 'Point rewards', 'Photo proof', 'Live chat'].map(f => (
              <span key={f} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} ChoreSync
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 sm:px-12">

        {/* Mobile logo (hidden on desktop) */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">C</div>
          <span className="text-lg font-extrabold text-slate-900">ChoreSync</span>
        </Link>

        <div className="w-full max-w-sm">
          {/* Page heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
