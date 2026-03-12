import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { PageShell } from '@/components/PageShell'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'sfjc.dev',
    template: '%s | sfjc.dev'
  },
  description: 'Collection of fun brain games built with Next.js',
  keywords: ['games', 'brain games', 'puzzles', 'math games'],
  authors: [{ name: 'Game Hub' }],
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
        <PageShell>{children}</PageShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
