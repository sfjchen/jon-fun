'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type PageShellProps = {
  children: React.ReactNode
  title?: string
  showBack?: boolean
}

export function PageShell({ children, title, showBack }: PageShellProps) {
  const pathname = usePathname()
  const showBackLink = showBack ?? pathname !== '/'

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
    >
      <header className="border-b px-4 py-4" style={{ borderColor: 'var(--ink-border)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="font-lora font-semibold hover:opacity-80"
            style={{ color: 'var(--ink-text)' }}
          >
            sfjc.dev
          </Link>
          {showBackLink && (
            <Link
              href="/"
              className="text-sm hover:opacity-80"
              style={{ color: 'var(--ink-accent)' }}
            >
              ← Home
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {title && (
          <h1 className="mb-6 font-lora text-2xl font-semibold">
            {title}
          </h1>
        )}
        {children}
      </main>
    </div>
  )
}
