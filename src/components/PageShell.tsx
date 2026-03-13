'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

type PageShellProps = {
  children: React.ReactNode
  title?: string
  showBack?: boolean
}

function isFullBleed(pathname: string): boolean {
  return (
    pathname === '/games/pear-navigator' ||
    pathname.startsWith('/games/poker/lobby/') ||
    pathname.startsWith('/games/poker/table/') ||
    pathname === '/notebook/games/pear-navigator' ||
    pathname.startsWith('/notebook/games/poker/lobby/') ||
    pathname.startsWith('/notebook/games/poker/table/')
  )
}

export function PageShell({ children, title, showBack }: PageShellProps) {
  const pathname = usePathname()
  const isNotebook = pathname.startsWith('/notebook')
  const isHome = pathname === '/' || pathname === '/notebook'
  const showBackLink = showBack ?? !isHome
  const fullBleed = isFullBleed(pathname)
  const homeHref = isNotebook ? '/notebook' : '/'

  useEffect(() => {
    if (!fullBleed) return
    const prev = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev.html
      document.body.style.overflow = prev.body
    }
  }, [fullBleed])

  return (
    <div
      data-theme={isNotebook ? 'notebook' : undefined}
      className={`overflow-x-hidden ${fullBleed ? 'h-dynamic flex flex-col overflow-y-hidden' : 'min-h-screen'}`}
      style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
    >
      <header className={`flex-none ${fullBleed ? 'px-3 py-2' : 'px-4 py-4 md:py-6'} ${!isHome ? 'border-b' : ''}`} style={{ borderColor: 'var(--ink-border)' }}>
        <div className="mx-auto max-w-6xl flex w-full items-center justify-between">
          <div className="flex-1" />
          <Link
            href={homeHref}
            className={`font-lora font-semibold hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded shrink-0 ${
              isHome
                ? isNotebook
                  ? 'text-5xl md:text-6xl lg:text-7xl'
                  : 'text-4xl md:text-5xl lg:text-6xl'
                : fullBleed
                  ? isNotebook
                    ? 'text-3xl sm:text-4xl'
                    : 'text-2xl sm:text-3xl'
                  : isNotebook
                    ? 'text-3xl sm:text-4xl'
                    : ''
            }`}
            style={{ color: 'var(--ink-text)' }}
          >
            sfjc.dev
          </Link>
          <div className="flex flex-1 items-center justify-end gap-4">
            {showBackLink && (
              <Link
                href={homeHref}
                className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded"
                style={{ color: 'var(--ink-accent)' }}
              >
                ← Home
              </Link>
            )}
            {isNotebook ? (
              <Link href="/" className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded" style={{ color: 'var(--ink-accent)' }}>
                Main
              </Link>
            ) : (
              <Link href="/notebook" className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded" style={{ color: 'var(--ink-accent)' }}>
                Notebook
              </Link>
            )}
          </div>
        </div>
      </header>
      <main
        className={
          fullBleed
            ? 'flex-1 min-h-0 w-full max-w-none px-0 flex flex-col'
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
