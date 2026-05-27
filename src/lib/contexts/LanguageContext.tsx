'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { translations, type Locale, type TranslationKey } from '@/lib/i18n/translations'

interface LanguageContextValue {
  locale:    Locale
  setLocale: (l: Locale) => void
  t:         (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  locale:    'en',
  setLocale: () => undefined,
  t:         (key) => translations.en[key],
})

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('cs-locale') as Locale | null
    if (stored === 'en' || stored === 'es') return stored
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('es')) return 'es'
  } catch {
    // ignore
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const detected = detectLocale()
    setLocaleState(detected)
    document.documentElement.lang = detected
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    try { localStorage.setItem('cs-locale', l) } catch { /* ignore */ }
    document.documentElement.lang = l
  }

  function t(key: TranslationKey): string {
    return translations[locale][key] ?? translations.en[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
