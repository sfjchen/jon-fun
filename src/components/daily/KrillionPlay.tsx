'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import { runKey } from '@/lib/daily/saved-run'
import {
  answerLookup,
  beginKrillionRound,
  completeKrillionRound,
  judgeWith,
  krillionDiveNumber,
  newKrillionRun,
  pauseKrillionRun,
  restoreKrillionRun,
  resumeKrillionRun,
  KRILLION_BANDS,
  KRILLION_MISS,
  KRILLION_TIERS,
  type AnswerLookup,
  type KrillionAnswer,
  type KrillionRun,
  type KrillionResult,
  type KrillionJudgment,
} from '@/lib/krillion'
import { nextSiteMidnight, shiftDay, siteDay } from '@/lib/daily'
import KrillionReview from './KrillionReview'
export type { KrillionPuzzle } from '@/lib/krillion'
import type { KrillionPuzzle } from '@/lib/krillion'
export default function KrillionPlay({ puzzle, dailyDay }: { puzzle: KrillionPuzzle; dailyDay: string }) {
  const storageKey = runKey('krillion', dailyDay, puzzle.date)
  const [run, setRunState] = useState<KrillionRun>(() => {
    try {
      return restoreKrillionRun(JSON.parse(localStorage.getItem(storageKey) ?? 'null'), Date.now())
    } catch {
      return newKrillionRun()
    }
  })
  const [clock, setClock] = useState(() => Date.now()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [copied, setCopied] = useState(false),
    [saved, setSaved] = useState<{ index: number; list: string[] }>({ index: -1, list: [] }),
    [sheet, setSheet] = useState(0),
    [fix, setFix] = useState<{ from: string; to: string } | null>(null),
    [pct, setPct] = useState<{ score: number; betterThan: number; dist: number[] } | null>(null)
  const current = useRef(run),
    pending = useRef(false),
    submittedAt = useRef(0),
    abort = useRef<AbortController | null>(null),
    input = useRef<HTMLInputElement>(null),
    lookups = useRef(new Map<number, AnswerLookup>()),
    loading = useRef(new Set<number>())
  const setRun = useCallback((value: KrillionRun | ((r: KrillionRun) => KrillionRun)) => {
    const next = typeof value === 'function' ? value(current.current) : value
    current.current = next
    setRunState(next)
  }, [])
  const remaining = Math.max(0, (run.endsAt ?? clock) - (run.pausedAt ?? clock)),
    total = run.outcomes.reduce((sum, r) => sum + r.score, 0),
    feedback = run.outcomes.at(-1)
  const finish = useCallback(
    (result: KrillionResult) => {
      setRun((r) => completeKrillionRound(r, result))
      setBusy(false)
      pending.current = false
      setMessage('')
    },
    [setRun],
  )
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 100)
    // The round clock stands still while the page is hidden, closed or left, and picks up on return. The pause is
    // written straight to storage because a closing page never reaches the effect that saves the run.
    const hold = (away: boolean) => {
      const now = Date.now()
      const next = (away ? pauseKrillionRun : resumeKrillionRun)(current.current, now)
      if (next !== current.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {}
        setRun(next)
      }
      setClock(now)
    }
    const sync = () => hold(document.hidden)
    const leave = () => hold(true)
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pageshow', sync)
      window.removeEventListener('pagehide', leave)
      leave()
      abort.current?.abort()
    }
  }, [setRun, storageKey])
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(run))
    } catch {}
    if (run.phase === 'done')
      logResult('krillion', total, run.outcomes.filter((a) => a.accepted).length, dailyDay, {
        moves: run.outcomes.map((o) => (o.accepted ? (o.matchedAnswer ?? o.answer) : '')),
        solved: true,
        sourceDate: puzzle.date,
        max: 700,
        scoringVersion: 2,
      })
  }, [run, total, dailyDay, puzzle.date, storageKey])
  useEffect(() => {
    if (run.phase === 'answering') input.current?.focus()
  }, [run.phase, run.index])
  useEffect(() => {
    if (run.phase !== 'done') return
    const ctl = new AbortController()
    fetch(`/api/krillion/percentile?d=${puzzle.date}&score=${total}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { betterThan: number; dist: number[] } | null) => {
        if (d) setPct({ score: total, ...d })
      })
      .catch(() => {})
    return () => ctl.abort()
  }, [run.phase, puzzle.date, total])
  // Each prompt's answer key loads 1 prompt ahead, so answers are judged on the device the moment they are sent.
  useEffect(() => {
    for (const i of [run.index, run.index + 1]) {
      if (i > 6 || lookups.current.has(i) || loading.current.has(i)) continue
      loading.current.add(i)
      fetch(`/api/krillion/review?d=${dailyDay}&prompt=${i}&all=1`)
        .then((r) => (r.ok ? r.json() : Promise.reject(Error('Answer key unavailable'))))
        .then((d: { answers: KrillionAnswer[] }) => {
          lookups.current.set(i, answerLookup(d.answers))
        })
        .catch(() => {})
        .finally(() => loading.current.delete(i))
    }
  }, [run.index, dailyDay])
  const submit = useCallback(
    async (final = false) => {
      const state = current.current
      const answer = state.draft.trim(),
        index = state.index
      // A blank answer only gets judged when time runs out, so it can close the round.
      if (state.phase !== 'answering' || pending.current || (!answer && !final)) return
      // Anything but an answer's own name first comes back as the original's correction, which replaces the typed
      // text. Sending it again scores it, and so does the clock running out.
      const preview = !final
      const apply = (data: KrillionJudgment) => {
        setFix(null)
        if (data.correction && !final && Date.now() < (current.current.endsAt ?? 0)) {
          const { correction } = data
          setFix(correction)
          setRun((r) => ({ ...r, draft: correction.to }))
          input.current?.focus()
          return
        }
        if (data.accepted) return finish(data)
        if (final || Date.now() >= (current.current.endsAt ?? 0)) return finish({ ...data, answer, score: 0 })
        setMessage(`"${answer.length > 40 ? `${answer.slice(0, 40)}…` : answer}": no echo. try again`)
        input.current?.focus()
        input.current?.select()
      }
      const local = lookups.current.get(index)
      if (local) {
        setMessage('')
        apply(judgeWith(local, answer, preview))
        return
      }
      // Without the key yet, the server judges the answer instead.
      pending.current = true
      submittedAt.current = Date.now()
      setBusy(true)
      setMessage('')
      const controller = new AbortController()
      abort.current = controller
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const r = await fetch('/api/krillion/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ day: dailyDay, index, answer, preview }),
        })
        const data = (await r.json()) as KrillionJudgment & { error?: string }
        if (current.current.phase !== 'answering' || current.current.index !== index) return
        if (!r.ok) throw Error(data.error ?? 'Signal lost. Resend your answer.')
        apply(data)
      } catch {
        if (controller.signal.aborted && current.current.phase !== 'answering') return
        if (final)
          finish({
            answer,
            accepted: false,
            score: 0,
            reason: 'Connection timed out before this answer could be verified.',
          })
        else setMessage('signal lost. resend')
      } finally {
        clearTimeout(timeout)
        pending.current = false
        setBusy(false)
      }
    },
    [dailyDay, finish, setRun],
  )
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (run.phase === 'answering' && run.endsAt !== null && run.pausedAt === undefined && clock >= run.endsAt) {
        if (pending.current) {
          if (clock >= Math.max(run.endsAt, submittedAt.current) + 4000) {
            abort.current?.abort()
            finish({
              answer: run.draft,
              accepted: false,
              score: 0,
              reason: 'No verified answer before the connection timeout.',
            })
          }
        } else void submit(true)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [clock, run, puzzle.answerMs, finish, submit, setRun])
  function next() {
    setMessage('')
    setClock(Date.now())
    markPracticeIfFuture('krillion', dailyDay)
    setRun((r) => (r.outcomes.length === 7 ? { ...r, phase: 'done', endsAt: null } : beginKrillionRound(r, Date.now())))
  }
  // Saved answers belong to the prompt they were typed for and drop away on the next one.
  const shelf = saved.index === run.index ? saved.list : []
  // Like the original's sonar, the clock turns hot for its last 3 seconds.
  const hot = remaining <= 3050
  const button = 'krillion-action'
  const tierOf = (r: KrillionResult) =>
    r.tier ? KRILLION_TIERS[r.tier] : { ...KRILLION_MISS, name: 'Nothing landed', score: 0, blurb: '' }
  // The final screen mirrors the original's: dive number, depth, a log of how deep each round sank, the score band,
  // the round list, this browser's logbook and the countdown to the next dive.
  let done: null | { dive: number; band: number; log: string; next: string; share: string } = null
  // The player curve copies the original's chart: 5-point smoothing of 20 bins, a Catmull-Rom line, the beaten
  // area shaded up to your score and a pink YOU marker.
  let curve: null | { line: string; area: string; x: number; y: number; label: string } = null
  if (pct && pct.score === total) {
    const k = [0.06, 0.24, 0.4, 0.24, 0.06],
      sm = pct.dist.map((_, i) => {
        let a = 0,
          n = 0
        for (let t = -2; t <= 2; t++) {
          const v = pct.dist[i + t]
          if (v === undefined) continue
          a += v * k[t + 2]!
          n += k[t + 2]!
        }
        return a / n
      }),
      top = Math.max(...sm)
    if (top > 0) {
      const pts: [number, number][] = [
          [0, 78],
          ...sm.map((v, i): [number, number] => [((i + 0.5) / sm.length) * 320, 78 - (v / top) * 68]),
          [320, 78],
        ],
        x = (Math.min(total, 700) / 700) * 320
      let y = 78
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i]!,
          [x2, y2] = pts[i + 1]!
        if (x >= x1 && x <= x2) {
          y = y1 + (y2 - y1) * (x2 === x1 ? 0 : (x - x1) / (x2 - x1))
          break
        }
      }
      let line = `M ${pts[0]![0]} ${pts[0]![1]}`
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[Math.max(0, i - 1)]!,
          b = pts[i]!,
          c = pts[i + 1]!,
          d = pts[Math.min(pts.length - 1, i + 2)]!
        line += ` C ${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6}, ${c[0] - (d[0] - b[0]) / 6} ${c[1] - (d[1] - b[1]) / 6}, ${c[0]} ${c[1]}`
      }
      curve = {
        line,
        area: `${line} L 320 78 L 0 78 Z`,
        x,
        y,
        label: pct.betterThan >= 99.5 ? pct.betterThan.toFixed(2) : String(pct.betterThan),
      }
    }
  }
  if (run.phase === 'done') {
    const days = new Map<string, number>()
    try {
      for (const k of Object.keys(localStorage)) {
        const m = /^krillion:v3:(\d{4}-\d{2}-\d{2}):/.exec(k),
          r = m && (JSON.parse(localStorage.getItem(k) ?? 'null') as KrillionRun | null)
        if (m && r?.phase === 'done')
          days.set(
            m[1]!,
            Math.max(
              days.get(m[1]!) ?? 0,
              r.outcomes.reduce((t, o) => t + o.score, 0),
            ),
          )
      }
    } catch {}
    days.set(dailyDay, Math.max(days.get(dailyDay) ?? 0, total))
    let streak = 0
    for (let d = dailyDay; days.has(d); d = shiftDay(d, -1)) streak++
    const scores = [...days.values()],
      dive = krillionDiveNumber(puzzle.date)
    const left = Math.max(0, Math.ceil((nextSiteMidnight(new Date(clock)) - clock) / 1000))
    done = {
      dive,
      band: KRILLION_BANDS.findLastIndex((b) => total >= b.min),
      log: `Streak ${streak} · Played ${scores.length} · Avg ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)} · Best ${Math.max(...scores)}`,
      next:
        dailyDay === siteDay()
          ? [left / 3600, (left / 60) % 60, left % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':')
          : '',
      share: `Krillion #${dive} 🦐\n${total}\n\n${run.outcomes.map((r) => tierOf(r).emoji).join('')}\nsfjc.dev/games/krillion`,
    }
  }
  return (
    <section className="space-y-5" data-testid="krillion-play">
      <div
        className="krillion-stage"
        data-phase={run.phase}
        style={{ backgroundColor: total >= 400 ? '#040a14' : total >= 100 ? '#09263e' : '#164765' }}
      >
        {(run.phase === 'ready' || total === 0) && (
          <div className="krillion-sky">
            <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
              <g fill="#e1f1ee">
                <path d="M40 60h30V45h35V30h50v15h30v15h40v15H40zM490 105h25V90h35V70h55v20h35v15h40v15H490zM260 40h35V25h45v15h60v15H260z" />
              </g>
              <path fill="#f9df8f" d="M690 15h50v10h10v50h-10v10h-50V75h-10V25h10z" />
              <path fill="#071a2c" d="M120 280h155l-15 18H130zM150 261h80v19h-80zM172 217h5v44h-5z" />
              <path fill="#fa4e87" d="M172 220h-25v12h25z" />
              <path
                d="M0 297Q70 285 140 297T280 297T420 297T560 297T700 297T840 297"
                fill="none"
                stroke="#2474a4"
                strokeWidth="10"
              />
            </svg>
            {run.phase === 'ready' && (
              <>
                <div className="krillion-title">KRILLION</div>
                <p className="krillion-subtitle">THE DAILY DIVE</p>
                <p className="krillion-tagline">7 prompts · 25 seconds each · rarer answers sink deeper</p>
              </>
            )}
          </div>
        )}
        <div className="krillion-ocean-decor" aria-hidden="true">
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none">
            <g fill="#041522" opacity=".7">
              <path d="M90 120q18-16 36 0-18 16-36 0l-10 8v-16zM760 310q22-18 44 0-22 18-44 0l-12 8v-16zM210 440q15-13 30 0-15 13-30 0l-9 6v-12z" />
            </g>
            <g fill="none" stroke="#9be1ed" opacity=".25">
              <circle cx="150" cy="210" r="3" />
              <circle cx="720" cy="80" r="2" />
              <circle cx="660" cy="480" r="4" />
            </g>
          </svg>
          <div className="krillion-depth-ruler">
            {[0, 100, 200, 300].map((n) => (
              <span key={n}>{(total * 10 + n).toLocaleString()}m</span>
            ))}
          </div>
        </div>
        <div className="krillion-hud">
          <span>
            Depth<strong>{(total * 10).toLocaleString()}m</strong>
          </span>
          <span className="text-center">Prompt {Math.min(run.index + 1, 7)} of 7</span>
          <span className="text-right">
            Score<strong>{total} / 700</strong>
          </span>
        </div>
        <div className="krillion-console space-y-5">
          <div className="krillion-rounds" aria-label={`${run.outcomes.length} of 7 rounds completed`}>
            {puzzle.prompts.map((p, i) => (
              <span key={p.id} data-complete={i < run.outcomes.length} />
            ))}
          </div>

          {run.phase === 'ready' ? (
            <>
              <details className="krillion-how">
                <summary>How to play</summary>
                <p>
                  Seven prompts. One accepted answer per round. You have 25 seconds per prompt. Rejected guesses can be
                  retried before time runs out; rarer accepted answers score more.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(KRILLION_TIERS).map(([id, t]) => (
                    <span key={id} className="rounded px-2 py-1 text-black" style={{ background: t.color }}>
                      {t.name} · {t.score}
                    </span>
                  ))}
                </div>
              </details>
              <button className={button} data-hotkey="Enter Space" onClick={next} aria-label="Begin dive">
                ▼ Begin descent ▼
              </button>
            </>
          ) : run.phase === 'done' && done ? (
            <div className="krillion-done" data-testid="krillion-result">
              <div className="flex items-baseline justify-between">
                <span className="krillion-done-krill">KRILLION</span>
                <span className="krillion-fathom-label">Dive #{done.dive} complete</span>
              </div>
              <p className="krillion-done-score">
                <strong>{total}</strong>
                <span>-{(total * 10).toLocaleString()}m</span>
              </p>
              {curve && (
                <div>
                  <svg
                    viewBox="0 0 320 96"
                    className="w-full"
                    role="img"
                    aria-label={`Score distribution of the original game's players; your score beats ${curve.label}% of them`}
                  >
                    <defs>
                      <linearGradient id="kr-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4de3ff" stopOpacity=".45" />
                        <stop offset="100%" stopColor="#4de3ff" stopOpacity=".02" />
                      </linearGradient>
                      <clipPath id="kr-beaten">
                        <rect x="0" y="0" width={curve.x} height="96" />
                      </clipPath>
                    </defs>
                    <path d={curve.area} fill="url(#kr-fill)" opacity=".28" />
                    <path d={curve.area} fill="url(#kr-fill)" clipPath="url(#kr-beaten)" />
                    <path d={curve.line} fill="none" stroke="#4de3ff" strokeWidth="1.4" strokeOpacity=".75" />
                    <line x1="0" y1="78" x2="320" y2="78" stroke="#7d93b838" />
                    {[100, 200, 300, 400, 500, 600].map((n) => {
                      const x = (n / 700) * 320
                      return (
                        <g key={n}>
                          <line x1={x} y1="78" x2={x} y2="81.5" stroke="#7d93b8" strokeOpacity=".5" />
                          {Math.abs(x - curve.x) >= 18 && (
                            <text x={x} y="90" textAnchor="middle" fontSize="9" fill="#7d93b8" opacity=".55">
                              {n}
                            </text>
                          )}
                        </g>
                      )
                    })}
                    <line
                      x1={curve.x}
                      y1={Math.min(curve.y, 74) - 3}
                      x2={curve.x}
                      y2="78"
                      stroke="#ff5d8f"
                      strokeWidth="1.2"
                    />
                    <circle cx={curve.x} cy={curve.y} r="2.6" fill="#ff5d8f" />
                    <text
                      x={Math.min(Math.max(curve.x, 14), 306)}
                      y="90"
                      textAnchor="middle"
                      fontSize="9"
                      letterSpacing=".12em"
                      fill="#ff5d8f"
                    >
                      YOU
                    </text>
                    <text x="0" y="90" fontSize="9" fill="#7d93b8" opacity=".6">
                      0
                    </text>
                    <text x="320" y="90" textAnchor="end" fontSize="9" fill="#7d93b8" opacity=".6">
                      700
                    </text>
                  </svg>
                  <p className="krillion-fathom-label text-[#4de3ff]">
                    better than {curve.label}% of the original game&apos;s players
                  </p>
                </div>
              )}
              {isPracticeResult('krillion', dailyDay) && (
                <p className="krillion-fathom-label">Future preview · practice only</p>
              )}
              <section>
                <h3 className="krillion-fathom">
                  <span>dive log</span>
                  <span>deeper = rarer</span>
                </h3>
                <svg
                  viewBox="0 0 320 190"
                  className="w-full"
                  role="img"
                  aria-label={`Dive log: ${run.outcomes.map((r, i) => `round ${i + 1} ${tierOf(r).name}`).join(', ')}`}
                >
                  {[0, 25, 50, 75, 100].map((n) => (
                    <g key={n}>
                      <line
                        x1="34"
                        x2="316"
                        y1={12 + n * 1.5}
                        y2={12 + n * 1.5}
                        stroke="#7d93b838"
                        strokeDasharray="3 4"
                      />
                      <text x="0" y={16 + n * 1.5} fill="#7d93b8" fontSize="12">
                        {n ? `-${n}` : '0m'}
                      </text>
                    </g>
                  ))}
                  {run.outcomes.map((r, i) => {
                    const t = tierOf(r),
                      x = 54 + i * 40,
                      y = 12 + t.depth * 150
                    return (
                      <g key={i}>
                        <line x1={x} x2={x} y1="12" y2={y} stroke={t.color} strokeOpacity=".55" strokeWidth="2" />
                        <text x={x} y={y + 6} textAnchor="middle" fontSize="16">
                          {t.emoji}
                        </text>
                        <text x={x} y="186" textAnchor="middle" fill="#7d93b8" fontSize="12">
                          {i + 1}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </section>
              <section>
                <h3 className="krillion-fathom">
                  <span>the bearing</span>
                </h3>
                <ul className="space-y-1">
                  {KRILLION_BANDS.map((b, i) => (
                    <li
                      key={b.range}
                      className="flex items-baseline gap-3"
                      style={{ color: i === done.band ? '#e8f1ff' : '#7d93b8b3' }}
                    >
                      <span>{KRILLION_TIERS[b.tier].emoji}</span>
                      <span className="w-16 shrink-0 text-[13px]" style={{ color: KRILLION_TIERS[b.tier].color }}>
                        {b.range}
                      </span>
                      <span>
                        {KRILLION_TIERS[b.tier].name}. {b.verdict}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="flex gap-3">
                <button
                  className="krillion-btn-descend flex-1"
                  data-hotkey="s"
                  onClick={() => {
                    void navigator.clipboard.writeText(done.share).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy result'}
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    className="krillion-btn-quiet"
                    onClick={() => {
                      void navigator.share({ text: done.share }).catch(() => {})
                    }}
                  >
                    Share…
                  </button>
                )}
              </div>
              <section>
                <h3 className="krillion-fathom">
                  <span>the catch</span>
                  <span>tap a round for every answer</span>
                </h3>
                <ol className="space-y-1">
                  {run.outcomes.map((r, i) => {
                    const t = tierOf(r)
                    return (
                      <li key={i}>
                        <button
                          className="krillion-catch-row"
                          onClick={() => {
                            setSheet(i)
                            document.getElementById('krillion-sheet')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          <span className="w-4 text-[#7d93b8]">{i + 1}</span>
                          <span>{t.emoji}</span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-xs text-[#7d93b8] uppercase">
                              {puzzle.prompts[i]?.text}
                            </span>
                            <span className="block truncate text-[17px]">
                              {r.accepted ? (r.matchedAnswer ?? r.answer) : r.answer ? `"${r.answer}"` : '—'}
                            </span>
                          </span>
                          <span style={{ color: t.color }}>{r.score ? `+${r.score}` : '−'}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
              <p className="krillion-fathom-label">logbook · {done.log}</p>
              {done.next && <p className="krillion-fathom-label text-[#4de3ff]">next dive in {done.next}</p>}
            </div>
          ) : run.phase === 'feedback' && feedback ? (
            <div className="krillion-landed" role="status">
              <h2
                style={{
                  color: tierOf(feedback).color,
                  textShadow: `0 0 22px ${tierOf(feedback).color}, 0 3px 0 #0009`,
                }}
              >
                {tierOf(feedback).name.toUpperCase()}
              </h2>
              <p className="krillion-tans">
                {feedback.accepted
                  ? `“${feedback.matchedAnswer ?? feedback.answer}”`
                  : feedback.answer
                    ? `“${feedback.answer}”`
                    : '—'}
              </p>
              <p className="krillion-tpts">
                <span style={{ color: tierOf(feedback).color }}>+{feedback.score} PTS</span>
                {feedback.score ? ` · sink ${(feedback.score * 10).toLocaleString()}m` : ''}
              </p>
              <p className="krillion-tsub">
                {feedback.accepted
                  ? (feedback.quip ?? tierOf(feedback).blurb)
                  : feedback.reason && !/accepted answer set|before the clock/.test(feedback.reason)
                    ? feedback.reason
                    : feedback.answer
                      ? 'never made it onto the reef.'
                      : 'the clock beat you to it.'}
              </p>
              <button className={button} data-hotkey="Enter Space ArrowDown" onClick={next}>
                {run.outcomes.length === 7 ? 'SURFACE ▲' : 'DESCEND ▼'}
              </button>
            </div>
          ) : (
            <>
              <span>Prompt {run.index + 1} / 7</span>
              <h2 className="font-lora text-2xl">{puzzle.prompts[run.index]?.text}</h2>
              <form
                className="krillion-answer-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit(remaining <= 0)
                }}
              >
                <div role="timer" aria-label="Seconds remaining" className="krillion-timer tabular-nums" data-hot={hot}>
                  <span className="krillion-sweep" aria-hidden="true" />
                  <span className="relative">{Math.ceil(remaining / 1000)}</span>
                </div>
                <label className="krillion-input">
                  <span className="sr-only">Your answer</span>
                  <input
                    ref={input}
                    aria-label="Your answer"
                    placeholder="type one answer…"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    maxLength={256}
                    readOnly={busy}
                    disabled={remaining <= 0}
                    value={run.draft}
                    onChange={(e) => {
                      setFix(null)
                      setRun((r) => ({ ...r, draft: e.target.value }))
                    }}
                    className="block w-full rounded border bg-[var(--ink-bg)] p-3"
                  />
                  <span className="krillion-fuse" data-hot={hot} aria-hidden="true">
                    <i style={{ transform: `scaleX(${remaining / puzzle.answerMs})` }} />
                  </span>
                  {run.draft && !busy && (
                    <button
                      type="button"
                      aria-label="Clear answer"
                      className="krillion-clear"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setRun((r) => ({ ...r, draft: '' }))
                        setMessage('')
                        setFix(null)
                        input.current?.focus()
                      }}
                    >
                      ×
                    </button>
                  )}
                </label>
                <button aria-label="Dive · submit answer" className={button} disabled={busy || remaining <= 0}>
                  {busy ? 'Checking…' : 'DIVE'}
                </button>
                {fix && fix.to === run.draft ? (
                  <p role="status" className="krillion-fix">
                    <span>
                      “{fix.from}” → “{fix.to}”
                    </span>
                    <span>submit again to confirm · or edit</span>
                  </p>
                ) : (
                  message && <p role="status">{message}</p>
                )}
                <div className="krillion-saved" aria-label="Saved answers">
                  <button
                    type="button"
                    className="krillion-chip"
                    disabled={!run.draft.trim() || shelf.includes(run.draft.trim())}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const a = run.draft.trim()
                      setSaved({ index: run.index, list: [a, ...shelf].slice(0, 5) })
                      input.current?.focus()
                    }}
                  >
                    ☆ Save
                  </button>
                  {shelf.map((a) => (
                    <button
                      key={a}
                      type="button"
                      title={a}
                      className="krillion-chip"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setRun((r) => ({ ...r, draft: a }))
                        setMessage('')
                        setFix(null)
                        input.current?.focus()
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      {run.outcomes.length > 0 && run.phase !== 'done' && (
        <details>
          <summary className="cursor-pointer underline">Your completed rounds</summary>
          <ol className="mt-3 space-y-3">
            {run.outcomes.map((r, i) => (
              <li key={i} className="rounded border p-3">
                <strong>
                  {i + 1}. {puzzle.prompts[i]?.text}
                </strong>
                <p>
                  {r.matchedAnswer ?? r.answer ?? 'No answer'} · {tierOf(r).name} · {r.score} points
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {run.phase === 'done' && (
        <KrillionReview key={sheet} date={puzzle.date} prompts={puzzle.prompts} index={sheet} onIndex={setSheet} />
      )}
    </section>
  )
}
