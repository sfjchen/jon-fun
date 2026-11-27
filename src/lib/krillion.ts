/** Rarity tiers as the original game shows them: points, color, share emoji, fallback line and dive-log depth. */
export const KRILLION_TIERS = {
  plankton: {
    name: 'Plankton',
    score: 10,
    color: '#8fa3c4',
    emoji: '🫧',
    depth: 0.08,
    blurb: 'The answer everyone blurts out.',
  },
  tooclever: {
    name: 'Too Clever',
    score: 15,
    color: '#ff9f43',
    emoji: '🤡',
    depth: 0.18,
    blurb: 'A famously “obscure” pick. Everyone reaches for it.',
  },
  schooler: {
    name: 'Schooler',
    score: 30,
    color: '#4de3ff',
    emoji: '🐟',
    depth: 0.36,
    blurb: 'Solid — swims with the school.',
  },
  rare: { name: 'Rare', score: 60, color: '#ff5252', emoji: '🦑', depth: 0.6, blurb: 'Genuinely uncommon. Nice pull.' },
  deepcut: {
    name: 'Deep Cut',
    score: 85,
    color: '#9d7bff',
    emoji: '🏮',
    depth: 0.82,
    blurb: 'True obscurity. Few go this deep.',
  },
  krillion: {
    name: 'One in a Krillion',
    score: 100,
    color: '#ffd166',
    emoji: '🌟',
    depth: 0.97,
    blurb: 'The designated gem. Trench floor.',
  },
} as const
/** How a missed round draws in the dive log and share text. */
export const KRILLION_MISS = { color: '#3d4f6e', emoji: '⬛', depth: 0.03 }
/** The original's final-score verdicts, from the lowest band up. */
export const KRILLION_BANDS = [
  { min: 0, range: '0–150', tier: 'plankton', verdict: 'Plenty of ocean left down there.' },
  { min: 151, range: '151–250', tier: 'schooler', verdict: 'Swimming with the school.' },
  { min: 251, range: '251–350', tier: 'rare', verdict: 'Below the thermocline. Nice.' },
  { min: 351, range: '351–449', tier: 'deepcut', verdict: 'Seriously deep dive.' },
  { min: 450, range: '450+', tier: 'krillion', verdict: 'Trench dweller. Absurd.' },
] as const
/** Returns the original's dive number for a date, counting dive #1 on 2026-07-16. */
export function krillionDiveNumber(date: string): number {
  return Math.round((Date.parse(date) - Date.parse('2026-07-16')) / 86400000) + 1
}
export type KrillionTier = keyof typeof KRILLION_TIERS
export type KrillionAnswer = { answer: string; aliases?: string[]; tier: KrillionTier; score: number; quip?: string }
export type KrillionPrompt = { id: string; text: string; answers: KrillionAnswer[] }
export type KrillionReview = { date: string; prompts: KrillionPrompt[] }
export type KrillionPuzzle = {
  date: string
  dayNumber?: number
  prompts: { id: string; text: string }[]
  answerMs: number
  officialScoring: true
}
export type KrillionResult = {
  answer: string
  accepted: boolean
  score: number
  tier?: KrillionTier
  matchedAnswer?: string
  quip?: string
  reason: string
}
/** A judgment, with the suggested answer when a close typo waits for the player to confirm it. */
export type KrillionJudgment = KrillionResult & { correction?: { from: string; to: string } }
/**
 * Normalizes like the original: no accents, case or apostrophes, "&" as "and", other punctuation as single spaces,
 * and no leading article.
 */
export function answerKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f'’‘ʼ`]/g, '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(an?|the) /, '')
}
/** Bounded Levenshtein distance, where a swap of 2 neighbors counts as 2 edits, as in the original. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let k = 1; k <= b.length; k++)
      next[k] = Math.min(next[k - 1]! + 1, prev[k]! + 1, prev[k - 1]! + (a[i - 1] === b[k - 1] ? 0 : 1))
    if (Math.min(...next) > limit) return limit + 1
    prev = next
  }
  return prev[b.length]!
}
/**
 * Returns a bit set of the characters in a text: 1 bit per letter a to z and 1 shared by all others. An edit changes
 * at most 2 bits, so 2 texts whose sets differ in more than twice the allowed edits cannot be a close match.
 */
function charBits(text: string): number {
  let bits = 0
  for (let i = 0; i < text.length; i++)
    bits |= 1 << Math.min(26, text.charCodeAt(i) - 97 < 0 ? 26 : text.charCodeAt(i) - 97)
  return bits
}
export type AnswerLookup = {
  exact: Map<string, KrillionAnswer>
  plural: Map<string, KrillionAnswer>
  /** Every spelling by its length, so a close match only scans the lengths within its edit allowance. */
  sized: Map<number, { key: string; words: string[]; bits: number; entry: KrillionAnswer; plural: boolean }[]>
}
/**
 * Indexes every normalized answer and alias of a prompt, keeping the first entry on a duplicate, then the English
 * plural of each ("ies" for a consonant and "y", "es" after s, x, z, ch or sh, else "s") where no answer has it.
 */
export function answerLookup(answers: KrillionAnswer[]): AnswerLookup {
  const lookup: AnswerLookup = { exact: new Map(), plural: new Map(), sized: new Map() }
  for (const plural of [false, true])
    for (const entry of answers)
      for (const alias of [entry.answer, ...(entry.aliases ?? [])]) {
        const base = answerKey(alias),
          key = !plural
            ? base
            : /[^aeiou]y$/.test(base)
              ? `${base.slice(0, -1)}ies`
              : `${base}${/(s|x|z|ch|sh)$/.test(base) ? 'es' : 's'}`
        if (!base || lookup.exact.has(key) || lookup.plural.has(key)) continue
        lookup[plural ? 'plural' : 'exact'].set(key, entry)
        const same = lookup.sized.get(key.length) ?? []
        if (!same.length) lookup.sized.set(key.length, same)
        same.push({ key, words: key.split(' '), bits: charBits(key), entry, plural })
      }
  return lookup
}
/**
 * Judges an answer by the rules that 2,300 probes of the original game's checker fit (2026-11-27).
 * - Only an exact normalized match to an answer's own name scores at once. An alias, a plural or singular, or a
 *   close match is a correction to that name.
 * - Plurals: an answer or alias also counts with its plural ending, and the typed text also counts with a final
 *   "s", "es" or "ies" taken off, or with "s" or "es" added when that spells an answer exactly.
 * - Close matches: text of n characters, spaces included, may be min(3, n / 4) edits away in total, so nothing under
 *   5 characters is corrected. A swap of 2 letters is 2 edits.
 * - Against a spelling with the same number of words, each word is compared with its own: a pair whose longer word
 *   has under 5 letters must be equal, 5 to 7 letters allow 1 edit (2 from 6 letters when both start with the same
 *   2 letters), 8 to 11 allow 2 and 12 or more allow 3.
 * - Against a spelling with another number of words, the whole texts are compared, each space counting as a letter.
 * - The closest spelling wins, one that differs only in its spaces first and a real spelling before a made plural.
 *   The probes do not settle further ties.
 * A correction comes back for the player to confirm while `preview` is on, and scores directly when it is off.
 */
export function judgeWith(lookup: AnswerLookup, answer: string, preview = false): KrillionJudgment {
  const key = answerKey(answer),
    forms = [key]
  for (const form of forms)
    for (const [end, to] of [
      ['ies', 'y'],
      ['es', ''],
      ['s', ''],
    ] as const) {
      const single = form.slice(0, -end.length) + to
      if (form.endsWith(end) && single && forms.length < 6 && !forms.includes(single)) forms.push(single)
    }
  let matched =
    forms.map((form) => lookup.exact.get(form) ?? lookup.plural.get(form)).find(Boolean) ??
    (key ? (lookup.exact.get(`${key}s`) ?? lookup.exact.get(`${key}es`)) : undefined)
  for (const form of matched ? [] : forms) {
    const words = form.split(' '),
      bits = charBits(form),
      max = form.length < 5 ? 0 : Math.min(3, form.length >> 2)
    let best = max + 1
    for (const c of [-3, -2, -1, 0, 1, 2, 3].flatMap((by) =>
      Math.abs(by) <= max ? (lookup.sized.get(form.length + by) ?? []) : [],
    )) {
      let d = 0,
        apart = 0
      for (let x = c.bits ^ bits; x; x &= x - 1) apart++
      if (apart > 2 * max) continue
      if (c.words.length !== words.length) d = editDistance(form, c.key, max)
      else
        for (let i = 0; i < words.length && d <= max; i++) {
          const a = words[i]!,
            b = c.words[i]!,
            len = Math.max(a.length, b.length)
          if (a === b) continue
          const cap = len < 5 ? 0 : len >= 12 ? 3 : len >= 8 || (len >= 6 && a.slice(0, 2) === b.slice(0, 2)) ? 2 : 1
          const edits = cap ? editDistance(a, b, cap) : 1
          d = edits > cap ? max + 1 : d + edits
        }
      if (d > max) continue
      const spaced = c.words.length !== words.length && c.key.replaceAll(' ', '') === form.replaceAll(' ', ''),
        rank = d + (c.plural ? 0.25 : 0) - (spaced ? 0.5 : 0)
      if (rank <= best) {
        best = rank
        matched = c.entry
      }
    }
    if (matched) break
  }
  if (!matched)
    return {
      answer,
      accepted: false,
      score: 0,
      reason: answer.trim() ? 'Not in this prompt’s accepted answer set.' : 'No answer before the clock ran out.',
    }
  if (preview && answerKey(matched.answer) !== key)
    return {
      answer,
      accepted: false,
      score: 0,
      correction: { from: answer, to: matched.answer },
      reason: 'Submit again to confirm',
    }
  return {
    answer,
    accepted: true,
    score: matched.score,
    tier: matched.tier,
    matchedAnswer: matched.answer,
    ...(matched.quip ? { quip: matched.quip } : {}),
    reason: `${KRILLION_TIERS[matched.tier].name} · ${matched.score} points`,
  }
}
export type KrillionRun = {
  phase: 'ready' | 'answering' | 'feedback' | 'done'
  index: number
  endsAt: number | null
  /** When the page was hidden or closed mid-round. The round clock stands still from then until the player returns. */
  pausedAt?: number | undefined
  draft: string
  outcomes: KrillionResult[]
}
export function newKrillionRun(): KrillionRun {
  return { phase: 'ready', index: 0, endsAt: null, draft: '', outcomes: [] }
}
export function beginKrillionRound(run: KrillionRun, now: number): KrillionRun {
  return { ...run, phase: 'answering', index: run.outcomes.length, endsAt: now + 25000, pausedAt: undefined, draft: '' }
}
export function completeKrillionRound(run: KrillionRun, result: KrillionResult): KrillionRun {
  if (run.phase !== 'answering' || run.outcomes.length !== run.index) return run
  return {
    ...run,
    phase: 'feedback',
    endsAt: null,
    pausedAt: undefined,
    draft: '',
    outcomes: [...run.outcomes, result],
  }
}
/**
 * Stops the round clock at `now`, for when the page is hidden or closed. A round already out of time stays expired.
 */
export function pauseKrillionRun(run: KrillionRun, now: number): KrillionRun {
  if (run.phase !== 'answering' || run.endsAt === null || run.pausedAt !== undefined || now >= run.endsAt) return run
  return { ...run, pausedAt: now }
}
/**
 * Restarts a paused round clock at `now` with the time it had left when it stopped.
 */
export function resumeKrillionRun(run: KrillionRun, now: number): KrillionRun {
  if (run.pausedAt === undefined) return run
  const away = Math.max(0, now - run.pausedAt)
  return { ...run, pausedAt: undefined, endsAt: run.endsAt === null ? null : run.endsAt + away }
}
export function restoreKrillionRun(value: unknown, now: number): KrillionRun {
  const r = value as KrillionRun
  if (
    !r ||
    !['ready', 'answering', 'feedback', 'done'].includes(r.phase) ||
    !Array.isArray(r.outcomes) ||
    r.outcomes.length > 7 ||
    !Number.isInteger(r.index) ||
    r.index < 0 ||
    r.index > 6 ||
    typeof r.draft !== 'string' ||
    (r.pausedAt !== undefined && typeof r.pausedAt !== 'number') ||
    r.outcomes.some((o) => typeof o.score !== 'number' || o.score < 0 || o.score > 100)
  )
    return newKrillionRun()
  let run = resumeKrillionRun(r, now)
  if (run.phase === 'answering' && run.endsAt !== null && now >= run.endsAt)
    run = completeKrillionRound(run, {
      answer: run.draft,
      accepted: false,
      score: 0,
      reason: 'The clock expired while you were away.',
    })
  return run
}
