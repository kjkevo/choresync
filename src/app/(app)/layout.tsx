import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import { LanguageProvider } from '@/lib/contexts/LanguageContext'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <ThemeProvider>
        <LanguageProvider>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <OfflineBanner />
          <div aria-live="polite" aria-atomic="true" id="sr-announcer" className="sr-only" />
        </LanguageProvider>
      </ThemeProvider>
    </>
  )
}
