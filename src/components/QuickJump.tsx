'use client'

/*
 * Cmd/Ctrl+K quick-jump menu, like Linear's and Raycast's. It lists every daily game, every home page item and the
 * main pages, filters them as you type, and opens the highlighted one with Enter. Arrow keys move the highlight and
 * Escape closes it. Mounted once in the root layout.
 */
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { GAMES, GAME_IDS } from '@/lib/results'
import { HOME_ITEMS } from '@/lib/site-links'

type Item = { title: string; href: string; icon?: string; group: string }

const ITEMS: Item[] = [
  ...GAME_IDS.map((g) => ({
    title: GAMES[g].title,
    href: GAMES[g].url,
    icon: `/doodles/notebook/${g}.svg`,
    group: 'Daily',
  })),
  { title: 'Leaderboard', href: '/leaderboards', group: 'Pages' },
  { title: 'Past NYT puzzles', href: '/games/archives', group: 'Pages' },
  { title: 'Home', href: '/', group: 'Pages' },
  ...HOME_ITEMS.filter((i) => i.available && !GAME_IDS.some((game) => GAMES[game].url === i.href)).map((i) => ({
    title: i.title,
    href: i.href,
    icon: i.icon,
    group: 'Games and tools',
  })),
]

/**
 * Ranks items for a query: titles that start with it first, then titles with a word starting with it, then any
 * match, keeping list order within each rank.
 */
function search(q: string): Item[] {
  const t = q.trim().toLowerCase()
  if (!t) return ITEMS
  const rank = (i: Item) => {
    const s = i.title.toLowerCase()
    return s.startsWith(t) ? 0 : s.split(/\W+/).some((w) => w.startsWith(t)) ? 1 : s.includes(t) ? 2 : 3
  }
  return ITEMS.map((i) => [i, rank(i)] as const)
    .filter(([, r]) => r < 3)
    .sort((a, b) => a[1] - b[1])
    .map(([i]) => i)
}

/**
 * Renders the menu while open and listens for Cmd/Ctrl+K anywhere on the site.
 */
export default function QuickJump() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const back = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        back.current = document.activeElement as HTMLElement | null
        setQ('')
        setAt(0)
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!open) return null
  const list = search(q)
  const close = () => {
    setOpen(false)
    back.current?.focus()
  }
  const go = (i: Item | undefined) => {
    if (!i) return
    setOpen(false)
    if (i.href.startsWith('http')) window.location.href = i.href
    else router.push(i.href)
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[15vh]" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--ink-bg)] font-sans text-[var(--ink-text)] shadow-2xl"
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="quick-jump-list"
          aria-activedescendant={list[at] ? `qj-${at}` : undefined}
          placeholder="Jump to a game or page…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setAt(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'Enter') go(list[at])
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setAt((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(1, list.length))
            } else return
          }}
          className="w-full border-b border-[var(--ink-border)] bg-transparent px-4 py-3.5 text-base outline-none"
        />
        <ul id="quick-jump-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {list.map((i, n) => (
            <li
              key={i.href}
              id={`qj-${n}`}
              role="option"
              aria-selected={n === at}
              onPointerMove={() => setAt(n)}
              onClick={() => go(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${n === at ? 'bg-[var(--ink-paper)]' : ''}`}
            >
              {i.icon ? (
                <Image src={i.icon} alt="" width={24} height={24} className="h-6 w-6" />
              ) : (
                <span className="h-6 w-6" />
              )}
              <span className="flex-1 font-medium">{i.title}</span>
              <span className="text-xs text-[var(--ink-muted)]">{i.group}</span>
            </li>
          ))}
          {!list.length && <li className="px-3 py-4 text-sm text-[var(--ink-muted)]">No match</li>}
        </ul>
      </div>
    </div>
  )
}
