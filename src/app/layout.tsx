import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Game Hub',
    template: '%s | Game Hub'
  },
  description: 'Collection of fun brain games built with Next.js',
  keywords: ['games', 'brain games', 'puzzles', 'math games'],
  authors: [{ name: 'Game Hub' }],
  robots: 'index, follow',
  icons: { icon: '/icon.svg?v=3' },
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
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
