'use client'

/**
 * Renders the Spelling Bee game: daily puzzle with archive navigation, practice puzzles, honeycomb input,
 * rank progress, found-word list, hints and yesterday's answers. Progress saves per puzzle in localStorage.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shuffle } from '@/lib/random'
import {
  RANKS,
  addDays,
  check,
  dailyId,
  dayNum,
  hints,
  isPangram,
  makePuzzle,
  praise,
  rankIdx,
  rankMins,
  score,
  today,
  type Puzzle,
} from '@/lib/spelling-bee'

type Data = { words: string[]; bank: string[] }
type Modal = 'hints' | 'yesterday' | 'ranks' | 'rules' | 'stats' | null

const YELLOW = '#f7da21'
const GRAY = '#e7e7e7'
const HEX = 'M-50 0 L-25 -43.3 L25 -43.3 L50 0 L25 43.3 L-25 43.3 Z'
/** Hex cell centers: center first, then clockwise from the top. */
const CELLS: [number, number][] = [
  [0, 0],
  [0, -92],
  [80, -46],
  [80, 46],
  [0, 92],
  [-80, 46],
  [-80, -46],
]
let cache: Promise<Data> | null = null

/**
 * Loads the word list and puzzle bank once per page load.
 */
function loadData() {
  cache ??= Promise.all([
    fetch('/spelling-bee/words.txt').then((r) => r.text()),
    fetch('/spelling-bee/puzzles.json').then((r) => r.json() as Promise<string[]>),
  ]).then(([w, bank]) => ({ words: w.split('\n'), bank }))
  return cache
}

/**
 * Reads the saved found words for a puzzle id.
 */
function loadFound(id: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`sb:${id}`) ?? '[]') as string[]
  } catch {
    return []
  }
}

/**
 * Renders this browser's daily stats (days played, average words found, current streak) and a copy-to-share button.
 */
function Stats({ now, share }: { now: string; share: string }) {
  const [copied, setCopied] = useState('')
  const days = new Map<string, number>()
  try {
    Object.keys(localStorage).forEach((k) => {
      const m = /^sb:(\d{4}-\d{2}-\d{2}):[a-z]{7}$/.exec(k)
      const n = m ? loadFound(k.slice(3)).length : 0
      if (n) days.set(m![1]!, n)
    })
  } catch {}
  let streak = 0
  for (let d = days.has(now) ? now : addDays(now, -1); days.has(d); d = addDays(d, -1)) streak++
  const cells: [string, number][] = [
    ['Days played', days.size],
    ['Avg words', days.size ? Math.round([...days.values()].reduce((a, b) => a + b, 0) / days.size) : 0],
    ['Day streak', streak],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {cells.map(([l, v]) => (
          <div key={l}>
            <p className="text-2xl font-bold tabular-nums">{v}</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {l}
            </p>
          </div>
        ))}
      </div>
      <button
        className="w-full rounded-full border px-5 py-2.5 text-[15px] font-medium"
        style={{ borderColor: '#dcdcdc' }}
        onClick={() =>
          navigator.clipboard.writeText(share).then(
            () => setCopied('Copied!'),
            () => setCopied('Copy failed'),
          )
        }
      >
        {copied || 'Copy result to share'}
      </button>
    </div>
  )
}

/**
 * Renders a centered dialog with a title and a close button.
 */
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl p-5 shadow-xl"
        style={{ background: 'var(--ink-bg)', color: 'var(--ink-text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-lora text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="px-2 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Renders a word list in columns, bolding pangrams and linking each word to its dictionary entry.
 */
function WordList({ words, found }: { words: string[]; found?: Set<string> }) {
  return (
    <ul className="columns-2 gap-6 text-[15px] sm:columns-3">
      {[...words].sort().map((w) => (
        <li key={w} className="break-inside-avoid border-b py-1" style={{ borderColor: 'var(--ink-border)' }}>
          <a
            href={`https://www.merriam-webster.com/dictionary/${w}`}
            target="_blank"
            rel="noreferrer"
            className={`capitalize hover:underline ${isPangram(w) ? 'font-bold' : ''}`}
            style={{ color: found && !found.has(w) ? 'var(--ink-muted)' : 'inherit' }}
          >
            {w}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Renders the hint grid and two-letter list for the words still left to find.
 */
function Hints({ pz, found }: { pz: Puzzle; found: string[] }) {
  const left = pz.answers.filter((w) => !found.includes(w))
  const { lens, grid, two } = hints(left)
  const pgLeft = pz.pangrams.filter((w) => !found.includes(w)).length
  const cell = 'px-1.5 py-0.5 text-center tabular-nums'
  return (
    <div className="space-y-4 text-sm">
      <p>
        {left.length} words, {pz.max - found.reduce((s, w) => s + score(w), 0)} points and {pgLeft} pangram
        {pgLeft === 1 ? '' : 's'} left.
      </p>
      {left.length > 0 && (
        <>
          <table className="font-mono">
            <thead>
              <tr>
                <th />
                {lens.map((l) => (
                  <th key={l} className={cell}>
                    {l}
                  </th>
                ))}
                <th className={cell}>Σ</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grid)
                .sort()
                .map(([c, row]) => (
                  <tr key={c}>
                    <th className={`${cell} uppercase`}>{c}</th>
                    {lens.map((l) => (
                      <td key={l} className={cell}>
                        {row[l] ?? '-'}
                      </td>
                    ))}
                    <td className={`${cell} font-semibold`}>{Object.values(row).reduce((s, n) => s + n, 0)}</td>
                  </tr>
                ))}
              <tr className="border-t font-semibold" style={{ borderColor: 'var(--ink-border)' }}>
                <th className={cell}>Σ</th>
                {lens.map((l) => (
                  <td key={l} className={cell}>
                    {left.filter((w) => w.length === l).length}
                  </td>
                ))}
                <td className={cell}>{left.length}</td>
              </tr>
            </tbody>
          </table>
          <p className="font-mono uppercase leading-7">
            {Object.keys(two)
              .sort()
              .map((k) => (
                <span key={k} className="mr-3 inline-block">
                  {k}-{two[k]}
                </span>
              ))}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Renders the full game page.
 */
export default function SpellingBee() {
  const router = useRouter()
  const params = useSearchParams()
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState(false)
  const [found, setFound] = useState<string[]>([])
  const [entry, setEntry] = useState('')
  const [order, setOrder] = useState([0, 1, 2, 3, 4, 5])
  const [toast, setToast] = useState<{ msg: string; ok: boolean; pts?: number } | null>(null)
  const [shake, setShake] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [crowd, setCrowd] = useState<{ players: number; genius: number } | null>(null)
  const tRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const now = today()
  const practice = params.get('p')
  const date = params.get('d') && params.get('d')! <= now && dayNum(params.get('d')!) >= 0 ? params.get('d')! : now

  useEffect(() => {
    loadData().then(setData, () => setErr(true))
  }, [])

  const pz = useMemo(() => {
    if (!data) return null
    const p =
      practice && /^[a-rt-z]{7}$/.test(practice) && new Set(practice).size === 7 && makePuzzle(practice, data.words)
    return p && p.pangrams.length && p.answers.length >= 5 ? p : makePuzzle(dailyId(date, data.bank), data.words)
  }, [data, practice, date])
  const isPractice = !!pz && pz.id === practice
  const key = pz && (isPractice ? `p:${pz.id}` : `${date}:${pz.id}`)

  const [cur, setCur] = useState<string | null>(null)
  if (key !== cur) {
    setCur(key)
    setFound(key ? loadFound(key) : [])
    setEntry('')
    setRevealed(false)
    setCrowd(null)
  }

  const pts = found.reduce((s, w) => s + score(w), 0)
  const rk = pz ? rankIdx(pts, pz.max) : 0
  const mins = pz ? rankMins(pz.max) : []
  const letters = pz ? [pz.center, ...order.map((i) => pz.outer[i])] : []

  const flash = useCallback((msg: string, ok: boolean, p?: number) => {
    clearTimeout(tRef.current)
    setToast(p ? { msg, ok, pts: p } : { msg, ok })
    if (!ok) setShake(true)
    tRef.current = setTimeout(
      () => {
        setToast(null)
        setShake(false)
        if (!ok) setEntry('')
      },
      ok ? 1100 : 700,
    )
  }, [])

  const n = found.length
  useEffect(() => {
    if (!pz || !key) return
    const t = setTimeout(() => {
      let device = ''
      try {
        device = localStorage.getItem('sb_device') ?? ''
        if (!device) localStorage.setItem('sb_device', (device = crypto.randomUUID()))
      } catch {}
      fetch('/api/spelling-bee/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, puzzle: key, words: n, score: pts, max: pz.max }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((c: { players: number; genius: number } | null) => c && setCrowd(c))
        .catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [pz, key, n, pts])

  const busy = toast?.ok === false
  const submit = useCallback(() => {
    if (!pz || !key || !entry || busy) return
    const e = check(entry, pz, found)
    if (e) return flash(e, false)
    const nf = [...found, entry]
    const nr = rankIdx(
      nf.reduce((s, w) => s + score(w), 0),
      pz.max,
    )
    setFound(nf)
    setEntry('')
    try {
      localStorage.setItem(`sb:${key}`, JSON.stringify(nf))
    } catch {}
    flash(nr === RANKS.length - 1 ? 'Queen Bee! 👑' : praise(entry), true, score(entry))
  }, [pz, key, entry, found, busy, flash])

  const type = useCallback(
    (c: string) => {
      if (!busy) setEntry((v) => (v.length < 19 ? v + c : v))
    },
    [busy],
  )

  const reorder = () => setOrder(shuffle(order))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') submit()
      else if (e.key === 'Backspace' || e.key === 'Delete') setEntry((v) => v.slice(0, -1))
      else if (e.key === ' ') reorder()
      else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase())
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const go = (q: string) => router.replace(`/games/spelling-bee${q}`, { scroll: false })

  if (err) return <p className="text-center">Couldn&apos;t load the word list. Refresh to try again.</p>
  if (!pz || !data)
    return (
      <p className="text-center" style={{ color: 'var(--ink-muted)' }}>
        Loading the hive…
      </p>
    )

  const yd = makePuzzle(dailyId(addDays(date, -1), data.bank), data.words)
  const btn = 'rounded-full border px-5 py-2.5 text-[15px] font-medium active:scale-95 transition'
  const link = 'text-[13px] md:text-sm underline underline-offset-2 disabled:opacity-30 disabled:no-underline'
  const label = isPractice
    ? 'Practice puzzle'
    : new Date(`${date}T12:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
  const sorted = [...found].sort()

  return (
    <div
      className="mx-auto w-full max-w-5xl select-none"
      style={{ color: 'var(--ink-text)', touchAction: 'manipulation' }}
    >
      <style>{`@keyframes sb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}
        75%{transform:translateX(8px)}}
        @keyframes sb-blink{50%{opacity:0}}`}</style>

      <header
        className="mb-3 flex flex-col gap-1.5 border-b pb-2 md:mb-4 md:flex-row md:items-end md:justify-between md:pb-3"
        style={{ borderColor: 'var(--ink-border)' }}
      >
        <div className="flex items-baseline justify-between gap-3 md:block">
          <h1 className="font-lora text-lg font-bold md:text-2xl">Spelling Bee</h1>
          <p className="flex items-center gap-2 text-xs md:text-sm" style={{ color: 'var(--ink-muted)' }}>
            {!isPractice && (
              <button
                className="px-1 text-base leading-none disabled:opacity-30"
                aria-label="Previous day"
                disabled={dayNum(date) <= 0}
                onClick={() => go(`?d=${addDays(date, -1)}`)}
              >
                ‹
              </button>
            )}
            {label}
            {!isPractice && (
              <button
                className="px-1 text-base leading-none disabled:opacity-30"
                aria-label="Next day"
                disabled={date >= now}
                onClick={() => go(addDays(date, 1) >= now ? '' : `?d=${addDays(date, 1)}`)}
              >
                ›
              </button>
            )}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4">
          {(isPractice || date !== now) && (
            <button className={link} onClick={() => go('')}>
              Today
            </button>
          )}
          <button className={link} onClick={() => go(`?p=${data.bank[Math.floor(Math.random() * data.bank.length)]}`)}>
            Random
          </button>
          <button className={link} onClick={() => setModal('hints')}>
            Hints
          </button>
          {!isPractice && dayNum(date) > 0 && (
            <button className={link} onClick={() => setModal('yesterday')}>
              Yesterday
            </button>
          )}
          <button className={link} onClick={() => setModal('stats')}>
            Stats
          </button>
          <button className={link} onClick={() => setModal('rules')}>
            Rules
          </button>
        </nav>
      </header>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr] md:gap-10">
        <section className="order-2 flex flex-col items-center md:order-1">
          <div className="relative flex h-12 w-full items-center justify-center md:h-16">
            {toast && (
              <div
                className="absolute -top-1 rounded-md px-3 py-1.5 text-sm font-semibold shadow"
                style={{
                  background: toast.ok ? 'var(--ink-bg)' : '#1a1a1a',
                  color: toast.ok ? 'var(--ink-text)' : '#fff',
                  border: '1px solid var(--ink-border)',
                }}
              >
                {toast.msg}
                {toast.pts && (
                  <span className="ml-2 font-bold" style={{ color: '#b8860b' }}>
                    +{toast.pts}
                  </span>
                )}
              </div>
            )}
            <p
              data-testid="sb-entry"
              className="mt-4 text-3xl font-bold uppercase tracking-wide md:mt-6"
              style={{ animation: shake ? 'sb-shake .3s 2' : undefined }}
            >
              {[...entry].map((c, i) => (
                <span
                  key={i}
                  style={{ color: c === pz.center ? '#d4ac0d' : pz.id.includes(c) ? 'inherit' : '#c4c4c4' }}
                >
                  {c}
                </span>
              ))}
              <span
                className="ml-0.5 inline-block w-0.5 align-middle"
                style={{ height: '1.1em', background: YELLOW, animation: 'sb-blink 1s step-end infinite' }}
              />
            </p>
          </div>

          <svg
            viewBox="-135 -140 270 280"
            className="my-1 w-full max-w-[min(250px,40svh)] md:my-3 md:max-w-[min(300px,55svh)]"
            aria-label="Letter hive"
            style={{ touchAction: 'manipulation' }}
          >
            {CELLS.map(([x, y], i) => [x, y, letters[i] ?? ''] as const).map(([x, y, c], i) => (
              <g
                key={i}
                transform={`translate(${x} ${y})`}
                className="cursor-pointer [&:active>path]:scale-[.86]"
                onClick={() => type(c)}
                role="button"
                aria-label={c}
              >
                <path d={HEX} fill={i ? GRAY : YELLOW} className="transition-transform duration-100" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="34"
                  fontWeight="700"
                  fill="#1a1a1a"
                  className="pointer-events-none uppercase"
                >
                  {c.toUpperCase()}
                </text>
              </g>
            ))}
          </svg>

          <div className="flex items-center gap-3">
            <button className={btn} style={{ borderColor: '#dcdcdc' }} onClick={() => setEntry((v) => v.slice(0, -1))}>
              Delete
            </button>
            <button
              className={`${btn} px-3.5`}
              style={{ borderColor: '#dcdcdc' }}
              onClick={reorder}
              aria-label="Shuffle"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
              </svg>
            </button>
            <button className={btn} style={{ borderColor: '#dcdcdc' }} onClick={submit}>
              Enter
            </button>
          </div>
          <p className="mt-4 hidden text-xs md:block" style={{ color: 'var(--ink-muted)' }}>
            Type letters · Enter submits · Space shuffles
          </p>
        </section>

        <section className="order-1 space-y-3 md:order-2 md:space-y-4">
          <button className="block w-full text-left" onClick={() => setModal('ranks')} aria-label="Show rankings">
            <div className="flex items-center gap-4">
              <span className="w-24 shrink-0 font-bold">{RANKS[rk]![0]}</span>
              <div className="relative flex h-6 flex-1 items-center">
                <div className="absolute inset-x-0 h-px" style={{ background: GRAY }} />
                <div className="relative flex w-full justify-between">
                  {mins.slice(0, -1).map(([n], i) =>
                    i === Math.min(rk, 8) ? (
                      <span
                        key={n}
                        className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: YELLOW }}
                      >
                        {pts}
                      </span>
                    ) : (
                      <span
                        key={n}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: i < rk ? YELLOW : GRAY }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              {[
                rk < 8 && `${mins[rk + 1]![1] - pts} to ${mins[rk + 1]![0]}`,
                rk < 7 && `${mins[8]![1] - pts} to Genius`,
                crowd?.players &&
                  `${crowd.players} player${crowd.players === 1 ? '' : 's'} ` +
                    `${isPractice || date !== now ? 'on this puzzle' : 'today'}` +
                    (crowd.genius ? ` (${crowd.genius} Genius)` : ''),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </button>

          <div className="rounded-lg border" style={{ borderColor: 'var(--ink-border)' }}>
            <button
              className={
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ' +
                  'md:pointer-events-none md:px-4 md:py-3 md:text-base'
              }
              onClick={() => setOpen((o) => !o)}
            >
              <span className="truncate">
                {open || found.length === 0 ? (
                  `You have found ${found.length} word${found.length === 1 ? '' : 's'}`
                ) : (
                  <span className="capitalize md:hidden">{[...found].reverse().join(' ')}</span>
                )}
                {!open && found.length > 0 && (
                  <span className="hidden md:inline">
                    You have found {found.length} word{found.length === 1 ? '' : 's'}
                  </span>
                )}
              </span>
              <span className="md:hidden">{open ? '▲' : '▼'}</span>
            </button>
            <div className={`px-4 pb-4 ${open ? '' : 'max-md:hidden'}`}>
              {revealed ? <WordList words={pz.answers} found={new Set(found)} /> : <WordList words={sorted} />}
              {isPractice && !revealed && found.length < pz.answers.length && (
                <button className={`${link} mt-3`} onClick={() => setRevealed(true)}>
                  Reveal all answers
                </button>
              )}
            </div>
          </div>
          {rk === RANKS.length - 1 && (
            <p className="text-center font-lora text-lg font-semibold">👑 Queen Bee! You found every word.</p>
          )}
        </section>
      </div>

      {modal === 'hints' && (
        <Dialog title="Hints" onClose={() => setModal(null)}>
          <Hints pz={pz} found={found} />
        </Dialog>
      )}
      {modal === 'yesterday' && (
        <Dialog title="Yesterday's answers" onClose={() => setModal(null)}>
          <p className="mb-3 text-2xl font-bold uppercase tracking-widest">
            <span style={{ color: '#d4ac0d' }}>{yd.center}</span>
            {yd.outer.join('')}
          </p>
          <WordList words={yd.answers} found={new Set(loadFound(`${addDays(date, -1)}:${yd.id}`))} />
        </Dialog>
      )}
      {modal === 'ranks' && (
        <Dialog title="Rankings" onClose={() => setModal(null)}>
          <p className="mb-3 text-sm">Ranks are based on a percentage of possible points in a puzzle.</p>
          <table className="w-full text-[15px]">
            <tbody>
              {[...mins].reverse().map(([n, m], i) => (
                <tr key={n} className={RANKS.length - 1 - i === rk ? 'font-bold' : ''}>
                  <td className="py-1">{n}</td>
                  <td className="py-1 text-right tabular-nums">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog>
      )}
      {modal === 'stats' && (
        <Dialog title="Your stats" onClose={() => setModal(null)}>
          <Stats
            now={now}
            share={
              `Spelling Bee ${isPractice ? 'practice' : date} · ${RANKS[rk]![0]} · ${pts}/${pz.max} points · ` +
              `${n} words\nsfjc.dev/games/spelling-bee${isPractice ? `?p=${pz.id}` : `?d=${date}`}`
            }
          />
        </Dialog>
      )}
      {modal === 'rules' && (
        <Dialog title="How to play" onClose={() => setModal(null)}>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
            <li>Make words of at least 4 letters from the 7 in the hive.</li>
            <li>Every word must use the center letter. Letters can repeat.</li>
            <li>No proper nouns, hyphenated or obscure words.</li>
            <li>4-letter words score 1 point. Longer words score 1 point per letter.</li>
            <li>Each puzzle has at least 1 pangram, which uses all 7 letters and earns 7 bonus points.</li>
            <li>A new daily puzzle starts at midnight. Random gives unlimited practice puzzles.</li>
          </ul>
        </Dialog>
      )}
    </div>
  )
}
