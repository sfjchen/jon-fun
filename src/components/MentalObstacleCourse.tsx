'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  MOC_E2E_QUERY,
  type CourseRunResult,
  type InputMode,
  type MentalDomain,
  type PatternProblem,
  type ArithmeticProblem,
  type TriviaItem,
  courseScoreFromDomains,
  detectInputMode,
  loadBestCourseScore,
  loadHistory,
  maybeUpdateBest,
  mocArithmeticDurationMs,
  mocMemoryShowDurationMs,
  mocScheduleReactionDelayMs,
  mocTriviaPerQuestionMs,
  mocWordTapDurationMs,
  pickTriviaBatch,
  randomArithmeticProblem,
  randomDigitString,
  randomPatternProblem,
  randomTapWord,
  randomTypingPhrase,
  saveRunToHistory,
  scoreArithmetic,
  scoreDigitSpan,
  scoreLogic,
  scoreReactionMedian,
  scoreTrivia,
  scoreWordBurst,
  scoreWordTap,
  shuffledLetters,
  strongestWeakest,
} from '@/lib/mental-obstacle-course'

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function RadarChart({ scores }: { scores: Record<MentalDomain, number> }) {
  const cx = 120
  const cy = 120
  const R = 88
  const n = DOMAIN_ORDER.length
  const pts = DOMAIN_ORDER.map((d, i) => {
    const angle = (360 / n) * i
    const r = (scores[d] / 100) * R
    return polarToCartesian(cx, cy, r, angle)
  })
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const grid = [0.25, 0.5, 0.75, 1].map((t) => {
    const ring = DOMAIN_ORDER.map((_, i) => {
      const angle = (360 / n) * i
      const p = polarToCartesian(cx, cy, R * t, angle)
      return `${p.x},${p.y}`
    }).join(' ')
    return <polygon key={t} points={ring} fill="none" stroke="var(--ink-border)" strokeWidth={0.75} opacity={0.5} />
  })
  const spokes = DOMAIN_ORDER.map((d, i) => {
    const angle = (360 / n) * i
    const outer = polarToCartesian(cx, cy, R, angle)
    const label = polarToCartesian(cx, cy, R + 22, angle)
    return (
      <g key={d}>
        <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--ink-border)" strokeWidth={0.75} opacity={0.6} />
        <text
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[9px] fill-[var(--ink-muted)] font-sans max-w-[48px]"
          style={{ fontSize: 9 }}
        >
          {DOMAIN_LABELS[d]}
        </text>
      </g>
    )
  })
  return (
    <svg
      data-testid="moc-radar"
      width={280}
      height={260}
      viewBox="0 0 240 240"
      className="mx-auto"
      aria-label="Radar chart of domain scores"
    >
      {grid}
      {spokes}
      <polygon points={poly} fill="var(--ink-accent)" fillOpacity={0.2} stroke="var(--ink-accent)" strokeWidth={2} />
    </svg>
  )
}

function ReactionPhase({ onDone, quickE2e }: { onDone: (score: number) => void; quickE2e: boolean }) {
  const [phase, setPhase] = useState<'wait' | 'go' | 'tooSoon'>('wait')
  const rts = useRef<number[]>([])
  const trial = useRef(0)
  const goAt = useRef(0)
  const toRef = useRef<number | null>(null)

  const clearT = () => {
    if (toRef.current != null) {
      window.clearTimeout(toRef.current)
      toRef.current = null
    }
  }

  const scheduleWait = useCallback(() => {
    clearT()
    toRef.current = window.setTimeout(() => {
      toRef.current = null
      setPhase('go')
      goAt.current = performance.now()
    }, mocScheduleReactionDelayMs(quickE2e))
  }, [quickE2e])

  useEffect(() => {
    if (phase === 'wait') scheduleWait()
    return clearT
  }, [phase, scheduleWait])

  const tap = () => {
    if (phase === 'wait') {
      clearT()
      setPhase('tooSoon')
      toRef.current = window.setTimeout(() => {
        toRef.current = null
        setPhase('wait')
      }, 550)
      return
    }
    if (phase === 'tooSoon') return
    if (phase === 'go') {
      const rt = performance.now() - goAt.current
      rts.current.push(rt)
      trial.current += 1
      if (trial.current >= 8) {
        clearT()
        onDone(scoreReactionMedian(rts.current))
        return
      }
      setPhase('wait')
    }
  }

  const label =
    phase === 'go'
      ? 'Tap now!'
      : phase === 'tooSoon'
        ? 'Too soon — wait for green'
        : 'Wait for green…'

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Reaction: tap when the panel turns green. 8 trials. Don&apos;t tap early.
      </p>
      <button
        type="button"
        data-testid="moc-reaction-tap"
        aria-label={`Reaction trial: ${label}`}
        onClick={tap}
        className="h-40 w-full max-w-sm rounded-xl border-4 text-xl font-semibold transition-colors md:h-48"
        style={{
          backgroundColor: phase === 'go' ? '#166534' : phase === 'tooSoon' ? '#b45309' : 'var(--ink-bg)',
          borderColor: 'var(--ink-border)',
          color: phase === 'go' ? '#fff' : 'var(--ink-text)',
        }}
      >
        {label}
      </button>
    </div>
  )
}

function ArithmeticPhase({ onDone, quickE2e }: { onDone: (score: number) => void; quickE2e: boolean }) {
  const durationMs = mocArithmeticDurationMs(quickE2e)
  const start = useRef(performance.now())
  const [prob, setProb] = useState<ArithmeticProblem>(() => randomArithmeticProblem())
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState(false)
  const [secLeft, setSecLeft] = useState(() => Math.ceil(durationMs / 1000))

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = performance.now() - start.current
      setSecLeft(Math.max(0, Math.ceil((durationMs - elapsed) / 1000)))
      if (elapsed > durationMs) setDone(true)
    }, 250)
    return () => clearInterval(id)
  }, [durationMs])

  useEffect(() => {
    if (!done) return
    onDone(scoreArithmetic(correct, wrong, performance.now() - start.current))
  }, [done, correct, wrong, onDone])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (done) return
    const n = parseInt(input.trim(), 10)
    if (Number.isNaN(n)) return
    if (n === prob.answer) setCorrect((c) => c + 1)
    else setWrong((w) => w + 1)
    setInput('')
    setProb(randomArithmeticProblem())
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Solve as many as you can. ~{secLeft}s left.
      </p>
      <div
        className="relative rounded-lg border p-6 text-center font-mono text-3xl"
        style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
      >
        {prob.prompt} = ?
        {quickE2e && (
          <span
            data-testid="moc-arithmetic-expected"
            className="sr-only"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {prob.answer}
          </span>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 font-mono text-lg"
          style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
          autoFocus
          aria-label="Answer"
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-white"
          style={{ backgroundColor: 'var(--ink-accent)' }}
        >
          OK
        </button>
      </form>
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Correct {correct} · Miss {wrong}
      </p>
    </div>
  )
}

function LogicPhase({ onDone, quickE2e }: { onDone: (score: number) => void; quickE2e: boolean }) {
  const [prob, setProb] = useState<PatternProblem>(() => randomPatternProblem())
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [roundStart, setRoundStart] = useState(() => performance.now())
  const times = useRef<number[]>([])

  const pick = (n: number) => {
    if (total >= 6) return
    const elapsed = performance.now() - roundStart
    times.current.push(elapsed)
    const nextCorrect = correct + (n === prob.answer ? 1 : 0)
    const nextTotal = total + 1
    setCorrect(nextCorrect)
    setTotal(nextTotal)
    if (nextTotal >= 6) {
      const avg = times.current.length
        ? times.current.reduce((a, b) => a + b, 0) / times.current.length
        : 15000
      onDone(scoreLogic(nextCorrect, 6, avg))
      return
    }
    setProb(randomPatternProblem())
    setRoundStart(performance.now())
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        What number continues the pattern? Round {Math.min(total + 1, 6)} / 6
      </p>
      <div
        className="rounded-lg border p-6 text-center font-mono text-xl"
        style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
      >
        {prob.prompt}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {prob.choices.map((c) => (
          <button
            key={c}
            type="button"
            data-testid={quickE2e && c === prob.answer ? 'moc-logic-correct' : undefined}
            onClick={() => pick(c)}
            className="rounded-lg border py-3 font-mono text-lg"
            style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

function MemoryPhase({ onDone, quickE2e }: { onDone: (score: number) => void; quickE2e: boolean }) {
  const [len, setLen] = useState(3)
  const [phase, setPhase] = useState<'show' | 'input' | 'done'>('show')
  const [digits, setDigits] = useState(() => randomDigitString(3))
  const [value, setValue] = useState('')
  const maxAchieved = useRef(0)

  useEffect(() => {
    if (phase !== 'show') return
    const showMs = mocMemoryShowDurationMs(quickE2e, len)
    const t = window.setTimeout(() => setPhase('input'), showMs)
    return () => clearTimeout(t)
  }, [phase, len, digits, quickE2e])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phase !== 'input') return
    if (value === digits) {
      maxAchieved.current = Math.max(maxAchieved.current, len)
      if (len >= 9) {
        setPhase('done')
        onDone(scoreDigitSpan(9))
        return
      }
      const nextLen = len + 1
      setLen(nextLen)
      setDigits(randomDigitString(nextLen))
      setValue('')
      setPhase('show')
    } else {
      setPhase('done')
      onDone(scoreDigitSpan(maxAchieved.current))
    }
  }

  if (phase === 'show') {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Memorize the digits ({len}).
        </p>
        <div
          data-testid="moc-memory-digits"
          className="font-mono text-4xl tracking-widest"
          style={{ color: 'var(--ink-text)' }}
        >
          {digits}
        </div>
      </div>
    )
  }

  if (phase === 'done') return null

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Type the digits you saw.
      </p>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border px-3 py-3 text-center font-mono text-2xl tracking-widest"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
        autoFocus
        aria-label="Digits"
      />
      <button type="submit" className="w-full rounded-lg py-2 text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
        Check
      </button>
    </form>
  )
}

function WordsPhase({
  touchMode,
  onDone,
  quickE2e,
}: {
  touchMode: boolean
  onDone: (score: number) => void
  quickE2e: boolean
}) {
  const phrase = useRef(randomTypingPhrase())
  const word = useRef(randomTapWord())
  const [typed, setTyped] = useState('')
  const start = useRef(performance.now())
  const [letters] = useState(() => shuffledLetters(word.current))
  const [picked, setPicked] = useState<string[]>([])
  const pickedRef = useRef<string[]>([])
  pickedRef.current = picked
  const [wrongTaps, setWrongTaps] = useState(0)
  const wrongRef = useRef(0)
  wrongRef.current = wrongTaps
  const [done, setDone] = useState(false)
  const wordTapMs = mocWordTapDurationMs(quickE2e)

  useEffect(() => {
    if (!touchMode || done) return
    const id = window.setInterval(() => {
      if (performance.now() - start.current > wordTapMs) {
        setDone(true)
        const target = word.current
        const ok = pickedRef.current.join('') === target
        onDone(scoreWordTap(ok, wrongRef.current, performance.now() - start.current, wordTapMs))
      }
    }, 300)
    return () => clearInterval(id)
  }, [touchMode, done, onDone, wordTapMs])

  if (touchMode) {
    const target = word.current
    const tapLetter = (ch: string) => {
      if (done) return
      setPicked((p) => {
        const nextIdx = p.length
        if (ch !== target[nextIdx]) {
          setWrongTaps((w) => w + 1)
          return p
        }
        const n = [...p, ch]
        if (n.length === target.length) {
          setDone(true)
          queueMicrotask(() =>
            onDone(scoreWordTap(true, wrongRef.current, performance.now() - start.current, wordTapMs)),
          )
        }
        return n
      })
    }

    return (
      <div className="mx-auto max-w-md space-y-4">
        {quickE2e && (
          <span data-testid="moc-word-target" className="hidden">
            {target}
          </span>
        )}
        <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Tap letters in order to spell the word ({target.length} letters).
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {letters.map((ch, i) => (
            <button
              key={`${ch}-${i}`}
              type="button"
              onClick={() => tapLetter(ch)}
              className="min-h-[44px] min-w-[44px] rounded-lg border text-lg font-mono font-bold"
              style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              {ch}
            </button>
          ))}
        </div>
        <p className="text-center font-mono" style={{ color: 'var(--ink-text)' }}>
          {picked.join('')}
        </p>
      </div>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (done) return
    setDone(true)
    const elapsed = performance.now() - start.current
    onDone(scoreWordBurst(phrase.current, typed, elapsed))
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Type the phrase exactly (lowercase ok).
      </p>
      <div
        data-testid="moc-typing-phrase"
        className="rounded-lg border p-4 font-mono text-lg"
        style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}
      >
        {phrase.current}
      </div>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 font-mono"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
        autoFocus
        aria-label="Type phrase"
      />
      <button type="submit" className="w-full rounded-lg py-2 text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
        Done
      </button>
    </form>
  )
}

function TriviaPhase({
  batch,
  onDone,
  quickE2e,
}: {
  batch: TriviaItem[]
  onDone: (score: number) => void
  quickE2e: boolean
}) {
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const finished = useRef(false)
  const correctRef = useRef(0)
  const perQMs = mocTriviaPerQuestionMs(quickE2e)

  useEffect(() => {
    correctRef.current = correct
  }, [correct])

  const finish = useCallback(
    (finalCorrect: number) => {
      if (finished.current) return
      finished.current = true
      setDone(true)
      onDone(scoreTrivia(finalCorrect, batch.length))
    },
    [batch.length, onDone],
  )

  useEffect(() => {
    if (done) return
    const t = window.setTimeout(() => {
      if (idx + 1 >= batch.length) {
        finish(correctRef.current)
      } else {
        setIdx((j) => j + 1)
      }
    }, perQMs)
    return () => clearTimeout(t)
  }, [idx, done, batch.length, finish, perQMs])

  const q = batch[idx]
  if (!q) {
    if (!done) finish(correctRef.current)
    return null
  }

  const pick = (i: number) => {
    if (done) return
    const nextCorrect = correct + (i === q.correct ? 1 : 0)
    correctRef.current = nextCorrect
    setCorrect(nextCorrect)
    if (idx + 1 >= batch.length) {
      finish(nextCorrect)
    } else {
      setIdx((j) => j + 1)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Trivia {idx + 1} / {batch.length}
      </p>
      <p className="text-center text-lg font-medium" style={{ color: 'var(--ink-text)' }}>
        {q.question}
      </p>
      <div className="grid gap-2">
        {q.choices.map((c, i) => (
          <button
            key={`${idx}-${i}-${c}`}
            type="button"
            data-testid={quickE2e && i === q.correct ? 'moc-trivia-correct' : undefined}
            onClick={() => pick(i)}
            className="rounded-lg border px-4 py-3 text-left text-sm"
            style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

type Screen = 'intro' | 'calibrate' | 'play' | 'results'

export default function MentalObstacleCourse() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const quickE2e = searchParams.get(MOC_E2E_QUERY) === '1'
  const base = pathname?.startsWith('/theme2') ? '/theme2' : ''
  const [screen, setScreen] = useState<Screen>('intro')
  const [clientReady, setClientReady] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('mixed')
  const [roundIdx, setRoundIdx] = useState(0)
  const accRef = useRef<Partial<Record<MentalDomain, number>>>({})
  const [result, setResult] = useState<CourseRunResult | null>(null)
  const [triviaBatch, setTriviaBatch] = useState(() => pickTriviaBatch(6))
  const [best, setBest] = useState(0)
  const [historyCount, setHistoryCount] = useState(0)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    setBest(loadBestCourseScore())
    setHistoryCount(loadHistory().length)
  }, [result])

  const onRoundComplete = useCallback(
    (domain: MentalDomain, score: number) => {
      accRef.current = { ...accRef.current, [domain]: score }
      const idx = DOMAIN_ORDER.indexOf(domain)
      const isLast = idx === DOMAIN_ORDER.length - 1
      if (isLast) {
        const filled = DOMAIN_ORDER.reduce(
          (acc, d) => {
            acc[d] = accRef.current[d] ?? 0
            return acc
          },
          {} as Record<MentalDomain, number>,
        )
        const courseScore = courseScoreFromDomains(filled)
        const { strongest, weakest } = strongestWeakest(filled)
        const run: CourseRunResult = {
          endedAt: Date.now(),
          inputMode,
          domainScores: filled,
          courseScore,
          summaryLine: `Strongest: ${strongest.map((d) => DOMAIN_LABELS[d]).join(', ')}. Growth edge: ${weakest.map((d) => DOMAIN_LABELS[d]).join(', ')}.`,
        }
        saveRunToHistory(run)
        maybeUpdateBest(run)
        setResult(run)
        setScreen('results')
      } else {
        setRoundIdx((i) => i + 1)
      }
    },
    [inputMode],
  )

  const start = () => {
    setInputMode(detectInputMode())
    setScreen('calibrate')
  }

  const beginPlay = () => {
    accRef.current = {}
    setTriviaBatch(pickTriviaBatch(6))
    setRoundIdx(0)
    setScreen('play')
  }

  const retry = () => {
    setResult(null)
    accRef.current = {}
    setRoundIdx(0)
    setScreen('intro')
  }

  const domain = DOMAIN_ORDER[roundIdx]

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 md:pb-28">
      <div>
        <h1 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          Mental Obstacle Course
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          One ~10-minute playful benchmark — not a clinical test or IQ score. Scores are for fun and self-comparison on this site.
        </p>
      </div>

      {screen === 'intro' && (
        <div
          className="space-y-4 rounded-lg border p-6"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ink-text)' }}>
            Six rounds: reaction, arithmetic, patterns, digit memory, words, trivia. You&apos;ll get a radar chart by mental area. Keyboard users get a typing round; narrow/touch devices get tap-letters instead.
          </p>
          {best > 0 && (
            <p className="text-sm" style={{ color: 'var(--ink-accent)' }}>
              Personal best course score (local): {best}
            </p>
          )}
          {historyCount > 0 && (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {historyCount} run{historyCount === 1 ? '' : 's'} stored on this device.
            </p>
          )}
          <button
            type="button"
            data-testid="moc-intro-continue"
            disabled={!clientReady}
            onClick={start}
            className="rounded-lg px-6 py-3 text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Continue
          </button>
        </div>
      )}

      {screen === 'calibrate' && (
        <div
          className="space-y-4 rounded-lg border p-6"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
            Input detected: {inputMode === 'keyboard' ? 'Keyboard / desktop' : 'Touch / narrow screen'}
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {inputMode === 'keyboard'
              ? 'Words round uses typing. For fair comparison later, we may separate leaderboards by input type.'
              : 'Words round uses tapping letters in order — no keyboard required.'}
          </p>
          <button
            type="button"
            data-testid="moc-start-course"
            onClick={beginPlay}
            className="rounded-lg px-6 py-3 text-white"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Start course
          </button>
        </div>
      )}

      {screen === 'play' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {DOMAIN_ORDER.map((d, i) => (
              <span
                key={d}
                className="rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: 'var(--ink-border)',
                  backgroundColor: i === roundIdx ? 'var(--ink-accent)' : 'transparent',
                  color: i === roundIdx ? '#fff' : 'var(--ink-muted)',
                }}
              >
                {i + 1}. {DOMAIN_LABELS[d]}
              </span>
            ))}
          </div>

          {domain === 'speed' && (
            <ReactionPhase quickE2e={quickE2e} onDone={(s) => onRoundComplete('speed', s)} />
          )}
          {domain === 'numbers' && (
            <ArithmeticPhase quickE2e={quickE2e} onDone={(s) => onRoundComplete('numbers', s)} />
          )}
          {domain === 'logic' && <LogicPhase quickE2e={quickE2e} onDone={(s) => onRoundComplete('logic', s)} />}
          {domain === 'workingMemory' && (
            <MemoryPhase quickE2e={quickE2e} onDone={(s) => onRoundComplete('workingMemory', s)} />
          )}
          {domain === 'words' && (
            <WordsPhase
              quickE2e={quickE2e}
              touchMode={inputMode !== 'keyboard'}
              onDone={(s) => onRoundComplete('words', s)}
            />
          )}
          {domain === 'knowledge' && (
            <TriviaPhase quickE2e={quickE2e} batch={triviaBatch} onDone={(s) => onRoundComplete('knowledge', s)} />
          )}
        </div>
      )}

      {screen === 'results' && result && (
        <div className="space-y-6">
          <div
            className="rounded-lg border p-6"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
          >
            <p className="text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
              Course score: {result.courseScore}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {result.summaryLine}
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
              Profile is relative to this obstacle course only — not a medical or employment assessment.
            </p>
          </div>
          <RadarChart scores={result.domainScores} />
          <div className="grid gap-2 sm:grid-cols-2">
            {DOMAIN_ORDER.map((d) => (
              <div
                key={d}
                data-testid={`moc-domain-${d}`}
                className="flex justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
              >
                <span>{DOMAIN_LABELS[d]}</span>
                <span className="font-mono">{result.domainScores[d]}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="moc-run-again"
              onClick={retry}
              className="rounded-lg px-5 py-2 text-white"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              Run again
            </button>
            <Link
              href={`${base}/`}
              className="rounded-lg border px-5 py-2 text-sm"
              style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-accent)' }}
            >
              Home
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
