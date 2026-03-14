'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type PageShellProps = {
  children: React.ReactNode
  title?: string
  showBack?: boolean
}

function isFullBleed(pathname: string, isChwaziMobile?: boolean): boolean {
  if (isChwaziMobile) return true
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

function isChwaziPath(pathname: string): boolean {
  return pathname?.includes('/games/chwazi') ?? false
}

export function PageShell({ children, title, showBack }: PageShellProps) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const isTheme2 = pathname.startsWith('/theme2')
  const chwaziMobile = isChwaziPath(pathname ?? '') && isMobile
  const isNotebook = !isTheme2 && !chwaziMobile
  const isHome = pathname === '/' || pathname === '/theme2'
  const showBackLink = showBack ?? !isHome
  const fullBleed = isFullBleed(pathname ?? '', chwaziMobile)
  const pearNav = isPearNavigator(pathname ?? '')
  const homeHref = isTheme2 ? '/theme2' : '/'
  const themeSwitchHref = isNotebook ? `/theme2${pathname === '/' ? '' : (pathname ?? '')}` : (pathname?.replace(/^\/theme2/, '') || '/')
  const useBigLogo = isNotebook && !pearNav

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const fn = () => setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

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

  const isCardPage = (pathname?.includes('/games/jeopardy') || pathname?.includes('/games/chwazi') || pathname?.includes('/leaderboards')) ?? false
  const outerLinePaper = isNotebook && !pearNav && !isCardPage
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
      {!chwaziMobile && (
        <Link
          href={themeSwitchHref}
          className="fixed right-4 z-40 text-sm px-3 py-2 rounded-lg bg-[var(--ink-paper)] border border-[var(--ink-border)] shadow-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2"
          style={{ color: 'var(--ink-accent)', bottom: 'calc(1rem + env(safe-area-inset-bottom, 0))' }}
        >
          {isNotebook ? 'Theme 2' : 'Main'}
        </Link>
      )}
    </div>
  )
}
