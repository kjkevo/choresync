import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  emoji?: string
}

/**
 * Shared shell for all auth pages.
 * Soft page background + card with a colourful gradient header panel.
 */
export default function AuthLayout({ children, title, subtitle, emoji = '🏠' }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50 flex flex-col items-center justify-center px-4 py-10">

      {/* Card */}
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl shadow-indigo-100/60 ring-1 ring-slate-100">

        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-violet-600 via-indigo-500 to-sky-400 px-8 pt-10 pb-12 text-center overflow-hidden">
          {/* Blob accents */}
          <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-4 -left-8 h-24 w-24 rounded-full bg-pink-400/20 blur-2xl" />

          {/* Logo link */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium mb-5 transition">
            ← ChoreSync
          </Link>

          {/* Big emoji */}
          <div className="mb-3 text-5xl drop-shadow-lg">{emoji}</div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/75">{subtitle}</p>
          )}
        </div>

        {/* Overlap pill — bridges header into body */}
        <div className="-mt-5 flex justify-center">
          <div className="h-5 w-16 rounded-full bg-white shadow-sm" />
        </div>

        {/* Form body */}
        <div className="px-7 pb-8 pt-2">
          {children}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} ChoreSync
      </p>
    </div>
  )
}
