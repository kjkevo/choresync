import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

/**
 * Shared shell for all auth pages (Login, Signup, Forgot Password, etc.).
 * Gradient hero on the left/top; white card for the form.
 */
export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* Decorative circles */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/8" />
      </div>

      {/* Hero text */}
      <div className="relative z-10 flex flex-col items-center pt-16 pb-10 px-6 text-center text-white">
        <Link href="/" className="mb-4 flex items-center gap-2 text-white/90 hover:text-white transition">
          <span className="text-4xl leading-none">🏠</span>
          <span className="text-2xl font-extrabold tracking-tight">ChoreSync</span>
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/75">{subtitle}</p>}
      </div>

      {/* Form card */}
      <div className="relative z-10 flex flex-1 flex-col items-center pb-10 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}
