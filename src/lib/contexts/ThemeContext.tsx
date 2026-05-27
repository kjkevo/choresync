'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme:            Theme
  isDark:           boolean
  setTheme:         (t: Theme) => void
  highContrast:     boolean
  setHighContrast:  (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:           'system',
  isDark:          false,
  setTheme:        () => undefined,
  highContrast:    false,
  setHighContrast: () => undefined,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState]               = useState<Theme>('system')
  const [isDark, setIsDark]                  = useState(false)
  const [highContrast, setHighContrastState] = useState(false)

  // On mount, read from localStorage and resolve "system"
  useEffect(() => {
    const stored = (localStorage.getItem('cs-theme') as Theme | null) ?? 'system'
    setThemeState(stored)
    applyTheme(stored)

    // High contrast
    const hc = localStorage.getItem('cs-high-contrast') === 'true'
    setHighContrastState(hc)
    document.documentElement.classList.toggle('high-contrast', hc)

    // Listen for OS preference changes (matters when theme === 'system')
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if ((localStorage.getItem('cs-theme') ?? 'system') === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function applyTheme(t: Theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = t === 'dark' || (t === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', dark)
    setIsDark(dark)
  }

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('cs-theme', t)
    applyTheme(t)
  }

  function setHighContrast(v: boolean) {
    setHighContrastState(v)
    localStorage.setItem('cs-high-contrast', String(v))
    document.documentElement.classList.toggle('high-contrast', v)
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, highContrast, setHighContrast }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
