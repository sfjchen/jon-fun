'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { GameCardGame } from '@/components/GameCard'
import { HOME_COMING_SOON_DEFAULTS, type HomeComingSoonCopy } from '@/data/home-coming-soon-defaults'

const nb = '/doodles/notebook'
/** Pear Navigator stays archived off home — see `@/data/notebook-home-games-archive` for the preserved card. */
const items: GameCardGame[] = [
  {
    id: 'veridian',
    title: 'Veridian Whiteboard',
    description: 'Draw math, analyze mistakes, Socratic chat — local-first AI whiteboard',
    icon: '/doodles/study.svg',
    href: '/veridian',
    available: true,
  },
  {
    id: 'e-reader',
    title: 'Web E-Reader',
    description: 'Import text or PDF files into a chapterized reader with typography controls, bookmarks, TTS, and local progress',
    icon: `${nb}/ereader.svg`,
    href: '/games/e-reader',
    available: true,
  },
  {
    id: 'five-can-sorting',
    title: '5 Can Sorting',
    description: 'Swap two cans at a time; only see how many are in the right place — deduce the hidden order',
    icon: `${nb}/cans.svg`,
    href: '/games/five-can-sorting',
    available: true,
  },
  { id: 'tmr', title: 'TMR System', description: 'Targeted Memory Reactivation for learning and sleep', icon: `${nb}/tmr.svg`, href: '/games/tmr', available: true },
  { id: 'daily-log', title: '1 Sentence Everyday', description: 'One sentence per day; history, calendar, export', icon: `${nb}/daily.svg`, href: '/games/daily-log', available: true },
  {
    id: 'uvimco-notes',
    title: 'Notes',
    description: 'Meeting shorthand + ? AI lookups; notes live in collapsible side panel',
    icon: `${nb}/daily.svg`,
    href: '/games/notes',
    available: true,
  },
  { id: '24', title: '24 (Jon\'s favorite)', description: '4 numbers, basic arithmetic → make 24', icon: `${nb}/game24.svg`, href: '/games/24', available: true },
  { id: 'jeopardy', title: 'Jeopardy with Friends', description: 'Create and play custom boards locally', icon: `${nb}/jeopardy.svg`, href: '/games/jeopardy', available: true },
  {
    id: 'connections',
    title: 'Connections',
    description: 'NYT-style groups of four; build puzzles and browse a public shelf',
    icon: `${nb}/connections.svg`,
    href: '/games/connections',
    available: true,
  },
  { id: 'poker', title: 'Texas Hold\'em chip tracker', description: 'Chip tracker with multiplayer lobbies', icon: `${nb}/poker.svg`, href: '/games/poker', available: true },
  { id: 'chwazi', title: 'Chwazi Finger Chooser', description: 'Touch screen to pick a winner', icon: `${nb}/chwazi.svg`, href: '/games/chwazi', available: true },
  {
    id: 'mental-obstacle-course',
    title: 'Mental Obstacle Course',
    description: 'Six-round brain benchmark: reaction, math, patterns, memory, words, trivia — radar chart (local scores)',
    icon: `${nb}/obstacle.svg`,
    href: '/games/mental-obstacle-course',
    available: true,
  },
  {
    id: 'ubi-ai',
    title: 'UBI × AI',
    description: 'R-backed scenario model: UBI social utility under AI job-security assumptions (sliders + charts)',
    icon: `${nb}/obstacle.svg`,
    href: '/games/ubi-ai',
    available: true,
  },
  {
    id: 'quip-clash',
    title: 'Quip Clash',
    description: 'PIN room party game: paired prompts, head-to-head votes, final round (Supabase + Realtime)',
    icon: `${nb}/quip-clash.svg`,
    href: '/games/quip-clash',
    available: true,
  },
  {
    id: 'fib-it',
    title: 'Fib It',
    description: 'Bluff-the-truth trivia: lies, picks, likes; 3 rounds (Fibbage-style mechanics)',
    icon: `${nb}/fib-it.svg`,
    href: '/games/fib-it',
    available: true,
  },
  {
    id: 'enough-about-you',
    title: 'Enough About You',
    description: 'Private intake, subject rounds, reputation bonus, final truth-vs-lie votes',
    icon: `${nb}/eay.svg`,
    href: '/games/enough-about-you',
    available: true,
  },
  { id: 'coming-soon', title: 'Coming Soon', description: 'More brain games in development', icon: `${nb}/coming-soon.svg`, href: '#', available: false },
]

export default function Home() {
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [copy, setCopy] = useState<HomeComingSoonCopy>(HOME_COMING_SOON_DEFAULTS)
  const [showEditor, setShowEditor] = useState(false)
  const [editPwd, setEditPwd] = useState('')
  const [editHeadline, setEditHeadline] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [editBullets, setEditBullets] = useState('')
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/home/coming-soon')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HomeComingSoonCopy | null) => {
        if (cancelled || !data?.headline || !data.intro || !Array.isArray(data.bullets)) return
        setCopy(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const gridItems = useMemo(
    () => items.map((item) => (item.id === 'coming-soon' ? { ...item, title: copy.headline } : item)),
    [copy.headline],
  )

  function openEditorFields() {
    setEditHeadline(copy.headline)
    setEditIntro(copy.intro)
    setEditBullets(copy.bullets.join('\n'))
    setEditPwd('')
    setSaveErr(null)
    setShowEditor(true)
  }

  async function saveEdits() {
    const bullets = editBullets
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    setSaveBusy(true)
    setSaveErr(null)
    try {
      const res = await fetch('/api/home/coming-soon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: editPwd,
          headline: editHeadline.trim(),
          intro: editIntro.trim(),
          bullets,
        }),
      })
      const raw = (await res.json().catch(() => null)) as { error?: string } & Partial<HomeComingSoonCopy> | null
      if (!res.ok) {
        setSaveErr(typeof raw?.error === 'string' ? raw.error : 'Save failed')
        return
      }
      if (raw && typeof raw.headline === 'string' && typeof raw.intro === 'string' && Array.isArray(raw.bullets)) {
        setCopy({ headline: raw.headline, intro: raw.intro, bullets: raw.bullets as string[] })
      }
      setShowEditor(false)
      setEditPwd('')
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <>
      <ul className="mx-auto grid w-full max-w-5xl list-none grid-cols-1 gap-x-8 gap-y-10 p-0 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12">
        {gridItems.map((item) => (
          <li key={item.id} className="min-h-0 flex">
            <GameCard
              game={item}
              onComingSoonClick={() => setShowComingSoon(true)}
              linePaper
              compact
              hideDescription
            />
          </li>
        ))}
      </ul>

      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border p-6 shadow-lg"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-lora flex items-center gap-2 text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
                <Image src="/doodles/notebook/coming-soon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                {copy.headline}
              </h2>
              <button
                onClick={() => {
                  setShowComingSoon(false)
                  setShowEditor(false)
                }}
                className="text-xl font-bold hover:opacity-70"
                style={{ color: 'var(--ink-text)' }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>
              {copy.intro}
            </p>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {copy.bullets.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start rounded-lg border p-3"
                  style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                >
                  <span className="mr-3 mt-1 text-lg" style={{ color: 'var(--ink-accent)' }}>•</span>
                  <span className="text-sm" style={{ color: 'var(--ink-text)' }}>{feature}</span>
                </div>
              ))}
            </div>

            {!showEditor ? (
              <p className="mb-4 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  style={{ color: 'var(--ink-accent)' }}
                  onClick={openEditorFields}
                >
                  Edit this message (password)
                </button>
              </p>
            ) : (
              <div
                className="mb-6 space-y-3 rounded-lg border p-4"
                style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}
              >
                <label className="block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={editPwd}
                    onChange={(e) => setEditPwd(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  />
                </label>
                <label className="block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
                  Headline (tile + modal title)
                  <input
                    type="text"
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  />
                </label>
                <label className="block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
                  Intro paragraph
                  <textarea
                    value={editIntro}
                    onChange={(e) => setEditIntro(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  />
                </label>
                <label className="block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
                  Bullets (one line each)
                  <textarea
                    value={editBullets}
                    onChange={(e) => setEditBullets(e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                    style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  />
                </label>
                {saveErr ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {saveErr}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdits()}
                    disabled={saveBusy}
                    className="rounded-lg px-4 py-2 text-sm text-white transition-colors hover:opacity-95 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--ink-accent)' }}
                  >
                    {saveBusy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditor(false)
                      setSaveErr(null)
                    }}
                    className="rounded-lg border px-4 py-2 text-sm"
                    style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => {
                  setShowComingSoon(false)
                  setShowEditor(false)
                }}
                className="rounded-lg px-6 py-2 text-white transition-colors hover:opacity-95"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
