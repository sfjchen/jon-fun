'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type PageShellProps = {
  children: React.ReactNode
  title?: string
  showBack?: boolean
}

function isFullBleed(pathname: string): boolean {
  return (
    pathname === '/games/pear-navigator' ||
    pathname.startsWith('/games/poker/lobby/') ||
    pathname.startsWith('/games/poker/table/')
  )
}

export function PageShell({ children, title, showBack }: PageShellProps) {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const showBackLink = showBack ?? !isHome
  const fullBleed = isFullBleed(pathname)

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
    >
      <header className={`px-4 py-4 md:py-6 ${!isHome ? 'border-b' : ''}`} style={{ borderColor: 'var(--ink-border)' }}>
        <div className={`mx-auto max-w-6xl flex items-center ${isHome ? 'justify-center' : 'justify-between'}`}>
          <Link
            href="/"
            className={`font-lora font-semibold hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded ${isHome ? 'text-4xl md:text-5xl lg:text-6xl' : ''}`}
            style={{ color: 'var(--ink-text)' }}
          >
            sfjc.dev
          </Link>
          {showBackLink && (
            <Link
              href="/"
              className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded"
              style={{ color: 'var(--ink-accent)' }}
            >
              ← Home
            </Link>
          )}
        </div>
      </header>
      <main
        className={
          fullBleed
            ? 'w-full max-w-none px-0'
            : `mx-auto max-w-6xl px-4 ${isHome ? 'py-8' : 'py-6'}`
        }
      >
        {title && !isHome && (
          <h1 className="mb-6 font-lora text-2xl font-semibold">
            {title}
          </h1>
        )}
        {children}
      </main>
    </div>
  )
}
