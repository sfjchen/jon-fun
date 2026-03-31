/**
 * Mental Obstacle Course — domain types, item generators, scoring (0–100), local persistence.
 * Playful benchmark only; not a clinical or IQ measure.
 */

export type MentalDomain =
  | 'speed'
  | 'workingMemory'
  | 'logic'
  | 'numbers'
  | 'words'
  | 'knowledge'

export const DOMAIN_ORDER: MentalDomain[] = [
  'speed',
  'numbers',
  'logic',
  'workingMemory',
  'words',
  'knowledge',
]

export const DOMAIN_LABELS: Record<MentalDomain, string> = {
  speed: 'Speed',
  numbers: 'Numbers',
  logic: 'Logic',
  workingMemory: 'Working memory',
  words: 'Words',
  knowledge: 'Knowledge',
}

export type InputMode = 'keyboard' | 'touch' | 'mixed'

export type CourseRunResult = {
  endedAt: number
  inputMode: InputMode
  domainScores: Record<MentalDomain, number>
  courseScore: number
  /** Optional per-domain notes for UI */
  summaryLine?: string
}

const STORAGE_HISTORY = 'moc-history-v1'
const STORAGE_BEST = 'moc-best-v1'
const MAX_HISTORY = 24

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function median(nums: number[]): number {
  if (nums.length === 0) return 300
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Reaction: median RT in ms; faster = higher score. ~180ms excellent, ~380ms weak. */
export function scoreReactionMedian(rtsMs: number[]): number {
  const valid = rtsMs.filter((t) => t >= 100 && t < 900)
  if (valid.length === 0) return 0
  const med = median(valid)
  const x = (380 - med) / (380 - 180)
  return Math.round(clamp(x, 0, 1) * 100)
}

/** Arithmetic sprint: accuracy-weighted throughput vs a soft target. */
export function scoreArithmetic(correct: number, wrong: number, durationMs: number): number {
  const t = Math.max(durationMs, 1)
  const cpm = (correct * 60000) / t
  const penalty = wrong * 8
  const raw = cpm * 4 - penalty
  return Math.round(clamp(raw, 0, 100))
}

/** Pattern logic: correct rounds / total, small time bonus. */
export function scoreLogic(correct: number, total: number, avgMsPerRound: number): number {
  const acc = total > 0 ? correct / total : 0
  const timeBonus = clamp((15000 - avgMsPerRound) / 150, 0, 0.15)
  return Math.round(clamp(acc + timeBonus, 0, 1) * 100)
}

/** Digit span: max length successfully recalled maps to score. */
export function scoreDigitSpan(maxLen: number): number {
  if (maxLen <= 0) return 0
  // 3 digits ~25, 4~40, 5~55, 6~70, 7~85, 8+ ~100
  const x = ((maxLen - 3) / 5) * 100
  return Math.round(clamp(x, 0, 100))
}

/** Typed phrase: accuracy primary, speed secondary. */
export function scoreWordBurst(
  expected: string,
  typed: string,
  elapsedMs: number,
): number {
  const exp = expected.trim().toLowerCase()
  const got = typed.trim().toLowerCase()
  if (exp.length === 0) return 0
  let matches = 0
  const n = Math.min(exp.length, got.length)
  for (let i = 0; i < n; i++) if (exp[i] === got[i]) matches++
  const acc = matches / exp.length
  const wpm = got.length / Math.max(elapsedMs / 60000, 0.001)
  const speedPart = clamp(wpm / 60, 0, 1) * 40
  return Math.round(acc * 60 + speedPart)
}

/** Mobile word: taps in order, time cap. */
export function scoreWordTap(perfect: boolean, wrongTaps: number, elapsedMs: number, timeLimitMs: number): number {
  if (!perfect) return Math.max(0, 40 - wrongTaps * 10)
  const timeLeft = clamp((timeLimitMs - elapsedMs) / timeLimitMs, 0, 1)
  return Math.round(55 + timeLeft * 45)
}

/** Trivia: percent correct with guess penalty on wrong. */
export function scoreTrivia(correct: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((correct / total) * 100)
}

export function courseScoreFromDomains(d: Record<MentalDomain, number>): number {
  const vals = DOMAIN_ORDER.map((k) => d[k])
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function detectInputMode(): InputMode {
  if (typeof window === 'undefined') return 'mixed'
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 767px)').matches
  if (coarse || narrow) return 'touch'
  return 'keyboard'
}

// --- Generators ---

function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1))
}

export type ArithmeticProblem = { prompt: string; answer: number }

export function randomArithmeticProblem(): ArithmeticProblem {
  const op = (['+', '-', '*'] as const)[randInt(0, 2)]!
  let a = randInt(2, 12)
  let b = randInt(2, 12)
  if (op === '-') {
    if (a < b) [a, b] = [b, a]
    return { prompt: `${a} − ${b}`, answer: a - b }
  }
  if (op === '+') return { prompt: `${a} + ${b}`, answer: a + b }
  a = randInt(2, 9)
  b = randInt(2, 9)
  return { prompt: `${a} × ${b}`, answer: a * b }
}

export type PatternProblem = {
  /** e.g. "2, 4, 6, ?" */
  prompt: string
  answer: number
  choices: number[]
}

function shuffle<T>(arr: T[]): T[] {
  const o = [...arr]
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[o[i], o[j]] = [o[j]!, o[i]!]
  }
  return o
}

export function randomPatternProblem(): PatternProblem {
  const kind = randInt(0, 3)
  let seq: number[]
  let ans: number
  if (kind === 0) {
    const start = randInt(1, 8)
    const step = randInt(2, 4)
    seq = [start, start + step, start + step * 2, start + step * 3]
    ans = start + step * 4
  } else if (kind === 1) {
    const start = randInt(1, 4)
    seq = [start, start * 2, start * 4, start * 8]
    ans = start * 16
  } else if (kind === 2) {
    const base = randInt(2, 5)
    seq = [base, base * base, base * base * base]
    ans = Math.pow(base, 4)
  } else {
    seq = [1, 4, 9, 16]
    ans = 25
  }
  const prompt = `${seq.join(', ')}, ?`
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const delta = randInt(-8, 8)
    const w = ans + delta
    if (w !== ans && w > 0 && w < 500) wrong.add(w)
  }
  const choices = shuffle([ans, ...[...wrong]])
  return { prompt, answer: ans, choices }
}

export type TriviaItem = {
  question: string
  choices: string[]
  /** index of correct */
  correct: number
}

const TRIVIA_BANK: TriviaItem[] = [
  {
    question: 'How many sides does a hexagon have?',
    choices: ['5', '6', '7', '8'],
    correct: 1,
  },
  {
    question: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
    correct: 2,
  },
  {
    question: 'What is the chemical symbol for water?',
    choices: ['O2', 'CO2', 'H2O', 'NaCl'],
    correct: 2,
  },
  {
    question: 'In computing, what does CPU stand for?',
    choices: [
      'Central Processing Unit',
      'Computer Personal Unit',
      'Core Program Utility',
      'Cached Page Updater',
    ],
    correct: 0,
  },
  {
    question: 'Which ocean is the largest?',
    choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    correct: 3,
  },
  {
    question: 'How many minutes are in one hour?',
    choices: ['30', '60', '100', '90'],
    correct: 1,
  },
  {
    question: 'What is 15% of 200?',
    choices: ['20', '25', '30', '35'],
    correct: 2,
  },
  {
    question: 'Which shape has three sides?',
    choices: ['Square', 'Triangle', 'Pentagon', 'Circle'],
    correct: 1,
  },
  {
    question: 'What does HTML stand for?',
    choices: [
      'HyperText Markup Language',
      'High Transfer Mode Link',
      'Home Tool Markup List',
      'Hyperlink Text Management Layer',
    ],
    correct: 0,
  },
  {
    question: 'Which month has 28 or 29 days in a leap year for February?',
    choices: ['January', 'February', 'March', 'April'],
    correct: 1,
  },
  {
    question: 'Speed of light is fastest in which medium?',
    choices: ['Water', 'Glass', 'Vacuum', 'Air'],
    correct: 2,
  },
  {
    question: 'A dozen equals how many items?',
    choices: ['10', '11', '12', '13'],
    correct: 2,
  },
]

export function pickTriviaBatch(count: number): TriviaItem[] {
  return shuffle([...TRIVIA_BANK]).slice(0, count)
}

const WORD_PHRASES = [
  'the quick fox',
  'type fast now',
  'mental course run',
  'sfjc dot dev hub',
  'logic speed words',
]

const TAP_WORDS = ['FOCUS', 'BRAIN', 'QUIZ', 'MIND', 'SHARP', 'CALM', 'FLOW', 'GRID']

export function randomTypingPhrase(): string {
  return WORD_PHRASES[randInt(0, WORD_PHRASES.length - 1)]!
}

export function randomTapWord(): string {
  return TAP_WORDS[randInt(0, TAP_WORDS.length - 1)]!
}

export function shuffledLetters(word: string): string[] {
  const letters = word.split('')
  let s = shuffle(letters)
  if (s.join('') === word && word.length > 1) s = shuffle(letters)
  return s
}

export function randomDigitString(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String(randInt(0, 9))
  return s
}

/** URL query key: `?mocE2e=1` shortens timers and exposes stable selectors for Playwright only. */
export const MOC_E2E_QUERY = 'mocE2e'

export function mocArithmeticDurationMs(quick: boolean): number {
  return quick ? 5_000 : 55_000
}

export function mocTriviaPerQuestionMs(quick: boolean): number {
  return quick ? 8_000 : 14_000
}

export function mocWordTapDurationMs(quick: boolean): number {
  /* Short in ?mocE2e=1 so mobile E2E can advance via timeout without brittle letter taps. */
  return quick ? 7_500 : 35_000
}

/** Delay before green “go” signal (one draw per call). */
export function mocScheduleReactionDelayMs(quick: boolean): number {
  return quick ? 50 + Math.random() * 120 : 800 + Math.random() * 2200
}

export function mocMemoryShowDurationMs(quick: boolean, len: number): number {
  return quick ? 180 + len * 100 : 800 + len * 350
}

// --- Persistence ---

export function loadHistory(): CourseRunResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY)
    if (!raw) return []
    const p = JSON.parse(raw) as CourseRunResult[]
    return Array.isArray(p) ? p.slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}

export function saveRunToHistory(run: CourseRunResult): void {
  if (typeof window === 'undefined') return
  const prev = loadHistory()
  const next = [run, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(next))
}

export function loadBestCourseScore(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(STORAGE_BEST)
    if (!raw) return 0
    const p = JSON.parse(raw) as { courseScore?: number }
    return typeof p.courseScore === 'number' ? p.courseScore : 0
  } catch {
    return 0
  }
}

export function maybeUpdateBest(run: CourseRunResult): boolean {
  if (typeof window === 'undefined') return false
  const prev = loadBestCourseScore()
  if (run.courseScore > prev) {
    localStorage.setItem(
      STORAGE_BEST,
      JSON.stringify({ courseScore: run.courseScore, at: run.endedAt }),
    )
    return true
  }
  return false
}

export function strongestWeakest(
  d: Record<MentalDomain, number>,
): { strongest: MentalDomain[]; weakest: MentalDomain[] } {
  const entries = DOMAIN_ORDER.map((k) => [k, d[k]] as const)
  const max = Math.max(...entries.map(([, v]) => v))
  const min = Math.min(...entries.map(([, v]) => v))
  return {
    strongest: entries.filter(([, v]) => v === max).map(([k]) => k),
    weakest: entries.filter(([, v]) => v === min).map(([k]) => k),
  }
}
