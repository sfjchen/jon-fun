'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { HomeLink } from '@/components/HomeLink'
import NamePrompt from '@/components/NamePrompt'
import { startStateSync } from '@/lib/stateSync'
import { ensureSyncIdentity } from '@/lib/syncIdentity'

type PageShellProps = {
  children: React.ReactNode
}

function isNotesPage(pathname: string): boolean {
  return pathname.includes('/games/notes')
}

function isFullBleed(pathname: string, isChwaziMobile?: boolean): boolean {
  if (isChwaziMobile) return true
  return (
    pathname === '/games/pear-navigator' ||
    pathname.startsWith('/games/poker/lobby/') ||
    pathname.startsWith('/games/poker/table/') ||
    isNotesPage(pathname)
  )
}

function isPearNavigator(pathname: string): boolean {
  return pathname.includes('pear-navigator')
}

function isChwaziPath(pathname: string): boolean {
  return pathname?.includes('/games/chwazi') ?? false
}

export function PageShell({ children }: PageShellProps) {
  useEffect(() => {
    void ensureSyncIdentity()
    return startStateSync()
  }, [])
  const pathname = usePathname()
  const ownDailyHeader = [
    '/games/set',
    '/games/triples',
    '/games/mini',
    '/games/crossword',
    '/games/headcount',
    '/games/chainle',
    '/games/krillion',
    '/games/anthropeum',
    '/games/wordle',
    '/games/orbs',
    '/games/orbs/local',
    '/games/orbs/archive',
    '/games/orbs/archive/play',
    '/games/spelling-bee',
    '/games/connections/daily',
    '/leaderboards',
    '/games/daily-log',
  ].includes(pathname ?? '')
  const gameTheme = ['/games/set', '/games/triples'].includes(pathname ?? '')
    ? 'set'
    : pathname?.startsWith('/games/connections')
      ? 'connections'
      : pathname === '/games/mini' || pathname === '/games/crossword'
        ? 'mini'
        : pathname === '/leaderboards'
          ? 'daily'
          : pathname === '/games/spelling-bee'
            ? 'bee'
            : pathname === '/games/krillion'
              ? 'krillion'
              : pathname === '/games/anthropeum'
                ? 'anthropeum'
                : pathname === '/games/wordle'
                  ? 'fivefold'
                  : pathname === '/games/orbs' || pathname?.startsWith('/games/orbs/')
                    ? 'orbs'
                    : undefined
  /** Pages that play or sync under the player's name ask a visitor with none for it. */
  const usesName =
    ownDailyHeader ||
    ['/games/poker', '/games/24', '/games/quip-clash', '/games/fib-it', '/games/enough-about-you'].some((route) =>
      pathname?.startsWith(route),
    )
  const notesPage = isNotesPage(pathname ?? '')
  const isMobile = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(max-width: 767px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(max-width: 767px)').matches,
    () => false,
  )
  const chwaziMobile = isChwaziPath(pathname ?? '') && isMobile
  const isNotebook = !chwaziMobile && !notesPage && !gameTheme
  const isHome = pathname === '/'
  const fullBleed = isFullBleed(pathname ?? '', chwaziMobile)
  const pearNav = isPearNavigator(pathname ?? '')
  const homeHref = '/'
  const useBigLogo = isNotebook && !pearNav
  /** Only home shows the sfjc.dev header. Every other page gets the full screen and a small home icon. */
  const gameRoute = !isHome
  const ownHome = (pathname ?? '').startsWith('/games/pear-navigator')

  const notebookTypographyRoot = isNotebook && !pearNav

  useEffect(() => {
    const root = document.documentElement
    if (notebookTypographyRoot) root.classList.add('notebook-theme-root')
    else root.classList.remove('notebook-theme-root')
    return () => root.classList.remove('notebook-theme-root')
  }, [notebookTypographyRoot])

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

  /** Line-paper shell on notebook routes except home (plain cream grid on `/`). Pear-navigator keeps its own full-bleed shell. */
  const outerLinePaper = isNotebook && !pearNav && !isHome
  const useCompactHeader = fullBleed && !useBigLogo
  const headerPadding = useCompactHeader ? 'px-3 py-2' : 'px-4 py-3 md:py-4'
  const logoSize = useBigLogo
    ? 'text-5xl md:text-6xl lg:text-7xl'
    : useCompactHeader
      ? 'text-2xl sm:text-3xl'
      : 'text-3xl md:text-4xl'
  /** Tighter horizontal gutters on phone so e-reader text column uses more width. */
  const readerReadCompact = (pathname ?? '').startsWith('/games/e-reader/read')
  const mainPadX = readerReadCompact ? 'px-2 sm:px-4' : 'px-4'

  if (notesPage) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden" style={{ backgroundColor: 'var(--uv-bg-base, #ffffff)' }}>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    )
  }

  return (
    <div
      data-theme={isNotebook ? 'notebook' : undefined}
      data-game-theme={gameTheme}
      className={`overflow-x-hidden ${fullBleed ? 'h-dynamic flex flex-col overflow-y-hidden' : 'min-h-screen'} ${outerLinePaper ? 'notebook-line-paper' : ''}`}
      style={
        outerLinePaper ? { color: 'var(--ink-text)' } : { backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }
      }
    >
      {/* Full-bleed pages float the home icon over their canvas; others get it in its own row so it never covers page controls. */}
      {gameRoute &&
        !ownHome &&
        !ownDailyHeader &&
        (fullBleed ? (
          <HomeLink
            variant={chwaziMobile ? 'dark' : 'default'}
            className={`fixed top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-50 ${chwaziMobile ? '' : 'rounded-full bg-[var(--ink-bg)]/85'}`}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-none justify-start px-2 pt-[max(0.25rem,env(safe-area-inset-top))] md:px-4 md:pt-3">
            <HomeLink />
          </div>
        ))}
      <header
        className={`flex-none ${gameRoute ? 'hidden' : ''} ${headerPadding} ${!isHome && !outerLinePaper ? 'border-b' : ''} ${outerLinePaper ? `flex h-[90px] flex-col justify-center bg-[var(--ink-paper)]` : ''}`}
        style={{ borderColor: 'var(--ink-border)' }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className={isHome ? 'hidden flex-1 sm:block' : 'flex-1'} />
          <Link
            href={homeHref}
            className={`shrink-0 rounded font-lora font-semibold hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 focus-visible:outline-none ${logoSize}`}
            style={{ color: 'var(--ink-text)' }}
          >
            sfjc.dev
          </Link>
          <div className="flex flex-1 justify-end">{isHome && <DailyHeader />}</div>
        </div>
      </header>
      <main
        className={
          fullBleed
            ? 'flex min-h-0 w-full max-w-none flex-1 flex-col px-0'
            : gameTheme
              ? 'game-page-main mx-auto w-full max-w-none px-4 pt-[max(0.25rem,env(safe-area-inset-top))] pb-8'
              : `mx-auto max-w-6xl ${mainPadX} ${
                  isHome && outerLinePaper
                    ? 'pt-[30px] pb-8'
                    : isHome
                      ? 'py-8'
                      : isNotebook && outerLinePaper
                        ? gameRoute
                          ? 'pt-0 pb-6 md:pb-8'
                          : 'pt-[30px] pb-8'
                        : 'py-6'
                } ${isNotebook ? 'min-h-[calc(100vh-6rem)]' : ''}`
        }
      >
        {usesName && <NamePrompt />}
        {children}
      </main>
    </div>
  )
}
