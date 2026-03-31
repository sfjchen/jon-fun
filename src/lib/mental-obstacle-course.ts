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
  const attempts = correct + wrong
  if (attempts <= 0) return 0
  const t = Math.max(durationMs, 1)
  const cpm = (correct * 60000) / t
  const acc = correct / attempts
  const pace = clamp(cpm / 20, 0, 1)
  const base = acc * 0.7 + pace * 0.3
  return Math.round(clamp(base, 0, 1) * 100)
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
  const speedPart = clamp(wpm / 48, 0, 1) * 30
  return Math.round(acc * 70 + speedPart)
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
  const kind = randInt(0, 4)
  if (kind === 0) {
    const a = randInt(18, 79)
    const b = randInt(12, 69)
    return { prompt: `${a} + ${b}`, answer: a + b }
  }
  if (kind === 1) {
    let a = randInt(40, 150)
    let b = randInt(15, 95)
    if (a < b) [a, b] = [b, a]
    return { prompt: `${a} − ${b}`, answer: a - b }
  }
  if (kind === 2) {
    const a = randInt(6, 16)
    const b = randInt(4, 13)
    return { prompt: `${a} × ${b}`, answer: a * b }
  }
  if (kind === 3) {
    const b = randInt(3, 14)
    const q = randInt(4, 18)
    const a = b * q
    return { prompt: `${a} ÷ ${b}`, answer: q }
  }
  const a = randInt(6, 28)
  const b = randInt(2, 11)
  const c = randInt(2, 9)
  return { prompt: `${a} + ${b} × ${c}`, answer: a + b * c }
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
  const kind = randInt(0, 6)
  let seq: number[]
  let ans: number
  if (kind === 0) {
    const start = randInt(3, 14)
    const step = randInt(3, 8)
    seq = [start, start + step, start + step * 2, start + step * 3]
    ans = start + step * 4
  } else if (kind === 1) {
    const start = randInt(2, 7)
    const mul = randInt(2, 4)
    seq = [start, start * mul, start * mul * mul, start * mul * mul * mul]
    ans = start * mul * mul * mul * mul
  } else if (kind === 2) {
    const base = randInt(3, 6)
    seq = [base, base * base, base * base * base]
    ans = Math.pow(base, 4)
  } else if (kind === 3) {
    const start = randInt(2, 9)
    const d = randInt(2, 5)
    seq = [start, start + d, start + d + (d + 1), start + d + (d + 1) + (d + 2)]
    ans = seq[3]! + (d + 3)
  } else if (kind === 4) {
    const a = randInt(2, 7)
    const b = randInt(6, 14)
    seq = [a, b, a + 2, b + 2]
    ans = a + 4
  } else if (kind === 5) {
    const s = randInt(2, 6)
    seq = [s, s + 3, s + 8, s + 15]
    ans = s + 24
  } else {
    const s = randInt(2, 10)
    seq = [s, s + 5, s + 12, s + 21]
    ans = s + 32
  }
  const prompt = `${seq.join(', ')}, ?`
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const delta = randInt(-6, 6)
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
    question: 'Which law states that pressure is inversely proportional to volume at constant temperature?',
    choices: ['Charles law', 'Avogadro law', 'Boyle law', 'Hooke law'],
    correct: 2,
  },
  {
    question: 'What is the derivative of x^3 at x = 2?',
    choices: ['6', '8', '10', '12'],
    correct: 3,
  },
  {
    question: 'Which sorting algorithm has average time complexity O(n log n)?',
    choices: ['Bubble sort', 'Insertion sort', 'Merge sort', 'Selection sort'],
    correct: 2,
  },
  {
    question: 'In probability, if events A and B are independent, P(A ∩ B) equals:',
    choices: ['P(A) + P(B)', 'P(A)P(B)', 'P(A)/P(B)', '1 - P(A)'],
    correct: 1,
  },
  {
    question: 'Which element has atomic number 26?',
    choices: ['Copper', 'Iron', 'Nickel', 'Zinc'],
    correct: 1,
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
    question: 'What is 17% of 350?',
    choices: ['49.5', '59.5', '69.5', '79.5'],
    correct: 1,
  },
  {
    question: 'In SQL, which clause is evaluated after GROUP BY to filter grouped rows?',
    choices: ['WHERE', 'LIMIT', 'HAVING', 'ORDER BY'],
    correct: 2,
  },
  {
    question: 'If f(x) = 2x + 3 and g(x) = x^2, what is f(g(2))?',
    choices: ['7', '9', '11', '13'],
    correct: 2,
  },
  {
    question: 'Which ocean current is known for warming Western Europe?',
    choices: ['Labrador Current', 'Gulf Stream', 'Canary Current', 'Benguela Current'],
    correct: 1,
  },
  {
    question: 'For a right triangle with legs 9 and 12, the hypotenuse is:',
    choices: ['13', '14', '15', '16'],
    correct: 2,
  },
  {
    question: 'Which data structure works on LIFO order?',
    choices: ['Queue', 'Stack', 'Heap', 'Graph'],
    correct: 1,
  },
  {
    question: 'Which statement about standard deviation is true?',
    choices: [
      'It measures central tendency',
      'It measures spread around the mean',
      'It is always greater than variance',
      'It cannot be zero',
    ],
    correct: 1,
  },
]

export function pickTriviaBatch(count: number): TriviaItem[] {
  return shuffle([...TRIVIA_BANK]).slice(0, count)
}

const WORD_PHRASES = [
  'during focused practice, calm repetition beats rushing through each question',
  'balanced performance comes from steady attention, accuracy, and consistent pacing',
  'train the fundamentals first, then add speed without sacrificing control',
  'small gains in each domain add up to meaningful progress over time',
  'when a round feels hard, slow down, breathe, and commit to a clean attempt',
]

const TAP_WORDS = ['FOCUSING', 'BALANCED', 'PATTERNS', 'MEMORIES', 'STAMINAS', 'CONTROLS', 'CONSISTS', 'ATTENTIVE']

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
