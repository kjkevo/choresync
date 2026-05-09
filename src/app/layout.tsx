import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'ChoreSync', template: '%s | ChoreSync' },
  description: 'The household chore tracker that actually keeps everyone accountable.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

/**
 * Inline script applied before hydration to avoid flash-of-unstyled-content
 * when dark mode is stored in localStorage.
 */
const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('cs-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning prevents React from complaining about the
          'dark' class that may be added by the inline script before hydration */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
