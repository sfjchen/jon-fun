import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { PageShell } from '@/components/PageShell'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'sfjc.dev',
    template: '%s | sfjc.dev'
  },
  description: 'A collection of fun games and projects by Jonathan Chen',
  keywords: ['games', 'party games', 'puzzles', 'projects'],
  authors: [{ name: 'Jonathan Chen' }],
  robots: 'index, follow',
  icons: { icon: '/icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
