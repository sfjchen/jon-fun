import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Hotkeys from '@/components/Hotkeys'
import UndoBar from '@/components/UndoBar'
import QuickJump from '@/components/QuickJump'
import { PageShell } from '@/components/PageShell'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'sfjc.dev',
    template: '%s | sfjc.dev',
  },
  description: 'A collection of fun games and projects by Jonathan Chen',
  keywords: ['games', 'party games', 'puzzles', 'projects'],
  authors: [{ name: 'Jonathan Chen' }],
  robots: 'index, follow',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: 'sfjc', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fcf9f4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <div className="min-h-screen" style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }} />
          }
        >
          <PageShell>{children}</PageShell>
        </Suspense>
        <Hotkeys />
        <UndoBar />
        <QuickJump />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
