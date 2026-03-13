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
    pathname === '/theme2/games/pear-navigator' ||
    pathname.startsWith('/theme2/games/poker/lobby/') ||
    pathname.startsWith('/theme2/games/poker/table/')
  )
}

function isPearNavigator(pathname: string): boolean {
  return pathname.includes('pear-navigator')
}

export function PageShell({ children, title, showBack }: PageShellProps) {
  const pathname = usePathname()
  const isTheme2 = pathname.startsWith('/theme2')
  const isNotebook = !isTheme2
  const isHome = pathname === '/' || pathname === '/theme2'
  const showBackLink = showBack ?? !isHome
  const fullBleed = isFullBleed(pathname)
  const pearNav = isPearNavigator(pathname ?? '')
  const homeHref = isTheme2 ? '/theme2' : '/'
  const useBigLogo = isNotebook && !pearNav

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

  const outerLinePaper = isNotebook && !pearNav
  return (
    <div
      data-theme={isNotebook ? 'notebook' : undefined}
      className={`overflow-x-hidden ${fullBleed ? 'h-dynamic flex flex-col overflow-y-hidden' : 'min-h-screen'} ${outerLinePaper ? 'notebook-line-paper' : ''}`}
      style={outerLinePaper ? { color: 'var(--ink-text)' } : { backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
    >
      <header className={`flex-none ${fullBleed && !useBigLogo ? 'px-3 py-2' : 'px-4 py-4 md:py-6'} ${!isHome ? 'border-b' : ''} ${outerLinePaper ? 'bg-[var(--ink-paper)] min-h-[120px] flex flex-col justify-center' : ''}`} style={{ borderColor: 'var(--ink-border)' }}>
        <div className="mx-auto max-w-6xl flex w-full items-center justify-between">
          <div className="flex-1" />
          <Link
            href={homeHref}
            className={`font-lora font-semibold hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded shrink-0 ${
              useBigLogo
                ? 'text-5xl md:text-6xl lg:text-7xl'
                : isHome
                  ? 'text-4xl md:text-5xl lg:text-6xl'
                  : fullBleed
                    ? 'text-2xl sm:text-3xl'
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
              <Link href="/theme2" className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded" style={{ color: 'var(--ink-accent)' }}>
                Theme 2
              </Link>
            ) : (
              <Link href="/" className="text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 rounded" style={{ color: 'var(--ink-accent)' }}>
                Main
              </Link>
            )}
          </div>
        </div>
      </header>
      <main
        className={
          fullBleed
            ? 'flex-1 min-h-0 w-full max-w-none px-0 flex flex-col'
            : `mx-auto max-w-6xl px-4 ${isHome && outerLinePaper ? 'pt-[30px] pb-8' : isHome ? 'py-8' : 'py-6'} ${isNotebook ? 'min-h-[calc(100vh-6rem)]' : ''}`
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
