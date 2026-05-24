import { ThemeProvider } from '@/lib/contexts/ThemeContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
