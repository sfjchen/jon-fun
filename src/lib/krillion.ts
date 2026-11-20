/** Rarity tiers as the original game shows them: points, color, share emoji, fallback line and dive-log depth. */
export const KRILLION_TIERS = {
  plankton: { name: 'Plankton', score: 10, color: '#8fa3c4', emoji: '🫧', depth: .08, blurb: 'The answer everyone blurts out.' },
  tooclever: { name: 'Too Clever', score: 15, color: '#ff9f43', emoji: '🤡', depth: .18, blurb: 'A famously “obscure” pick. Everyone reaches for it.' },
  schooler: { name: 'Schooler', score: 30, color: '#4de3ff', emoji: '🐟', depth: .36, blurb: 'Solid — swims with the school.' },
  rare: { name: 'Rare', score: 60, color: '#ff5252', emoji: '🦑', depth: .6, blurb: 'Genuinely uncommon. Nice pull.' },
  deepcut: { name: 'Deep Cut', score: 85, color: '#9d7bff', emoji: '🏮', depth: .82, blurb: 'True obscurity. Few go this deep.' },
  krillion: { name: 'One in a Krillion', score: 100, color: '#ffd166', emoji: '🌟', depth: .97, blurb: 'The designated gem. Trench floor.' },
} as const
/** How a missed round draws in the dive log and share text. */
export const KRILLION_MISS = { color: '#3d4f6e', emoji: '⬛', depth: .03 }
/** The original's final-score verdicts, from the lowest band up. */
export const KRILLION_BANDS = [
  { min: 0, range: '0–150', tier: 'plankton', verdict: 'Plenty of ocean left down there.' },
  { min: 151, range: '151–250', tier: 'schooler', verdict: 'Swimming with the school.' },
  { min: 251, range: '251–350', tier: 'rare', verdict: 'Below the thermocline. Nice.' },
  { min: 351, range: '351–449', tier: 'deepcut', verdict: 'Seriously deep dive.' },
  { min: 450, range: '450+', tier: 'krillion', verdict: 'Trench dweller. Absurd.' },
] as const
/** Returns the original's dive number for a date, counting dive #1 on 2026-07-16. */
export function krillionDiveNumber(date: string): number { return Math.round((Date.parse(date) - Date.parse('2026-07-16')) / 86400000) + 1 }
export type KrillionTier = keyof typeof KRILLION_TIERS
export type KrillionAnswer = { answer: string; aliases?: string[]; tier: KrillionTier; score: number; quip?: string }
export type KrillionPrompt = { id: string; text: string; answers: KrillionAnswer[] }
export type KrillionReview = { date: string; prompts: KrillionPrompt[] }
export type KrillionPuzzle = { date: string; dayNumber?: number; prompts: { id: string; text: string }[]; answerMs: number; officialScoring: true }
export type KrillionResult = { answer: string; accepted: boolean; score: number; tier?: KrillionTier; matchedAnswer?: string; quip?: string; reason: string }
/** A judgment, with the suggested answer when a close typo waits for the player to confirm it. */
export type KrillionJudgment = KrillionResult & { correction?: { from: string; to: string } }
/** Normalizes like the original: no accents or case, punctuation as single spaces, and no leading "the". */
export function answerKey(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/^the /, '')
}
/** Bounded edit distance for a conservative silent autocorrect. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length-b.length)>limit) return limit+1
  let prev=Array.from({length:b.length+1},(_,i)=>i)
  for(let i=1;i<=a.length;i++) {
    const next=[i]
    for(let k=1;k<=b.length;k++) next[k]=Math.min(next[k-1]!+1,prev[k]!+1,prev[k-1]!+(a[i-1]===b[k-1]?0:1))
    if(Math.min(...next)>limit) return limit+1
    prev=next
  }
  return prev[b.length]!
}
export type AnswerLookup = {
  exact: Map<string, KrillionAnswer>
  compact: Map<string, KrillionAnswer>
  keys: { key: string; entry: KrillionAnswer; canonical: boolean }[]
}
/** Indexes every normalized answer and alias of a prompt, in list order, keeping the first entry on a duplicate. */
export function answerLookup(answers: KrillionAnswer[]): AnswerLookup {
  const lookup: AnswerLookup = { exact: new Map(), compact: new Map(), keys: [] }
  for (const entry of answers) [entry.answer, ...entry.aliases ?? []].forEach((alias, i) => {
    const key = answerKey(alias)
    if (!key || lookup.exact.has(key)) return
    lookup.exact.set(key, entry)
    if (!lookup.compact.has(key.replaceAll(' ', ''))) lookup.compact.set(key.replaceAll(' ', ''), entry)
    lookup.keys.push({ key, entry, canonical: i === 0 })
  })
  return lookup
}
/**
 * Judges an answer the way probes of the original game showed it works. An exact normalized match to an answer
 * or alias scores at once. Otherwise, from 5 letters up, the closest answer or alias within min(3, 0.28 × its
 * length) Levenshtein edits wins, with spaces counted and ties going to a canonical answer, then list order. The
 * same text without spaces also counts as close. A close match comes back as a correction to the canonical
 * answer while `preview` is on, and scores directly once the player confirms it or the clock runs out.
 */
export function judgeWith(lookup: AnswerLookup, answer: string, preview = false): KrillionJudgment {
  const key = answerKey(answer), compact = key.replaceAll(' ', '')
  let matched = key ? lookup.exact.get(key) : undefined
  const exact = !!matched
  if (!matched && compact) matched = lookup.compact.get(compact)
  if (!matched && compact.length >= 5) {
    let best = { d: 4, canonical: false }
    for (const c of lookup.keys) {
      const max = Math.min(3, Math.floor(c.key.length * .28))
      if (!max || Math.abs(c.key.length - key.length) > max) continue
      const d = editDistance(key, c.key, max)
      if (d <= max && (d < best.d || (d === best.d && c.canonical && !best.canonical))) { best = { d, canonical: c.canonical }; matched = c.entry }
    }
  }
  if (!matched) return { answer, accepted: false, score: 0, reason: answer.trim() ? 'Not in this prompt’s accepted answer set.' : 'No answer before the clock ran out.' }
  if (!exact && preview) return { answer, accepted: false, score: 0, correction: { from: answer, to: matched.answer }, reason: 'Submit again to confirm' }
  return { answer, accepted: true, score: matched.score, tier: matched.tier, matchedAnswer: matched.answer,
    ...(matched.quip ? { quip: matched.quip } : {}), reason: `${KRILLION_TIERS[matched.tier].name} · ${matched.score} points` }
}
export type KrillionRun = { phase:'ready'|'answering'|'feedback'|'done'; index:number; endsAt:number|null; draft:string; outcomes:KrillionResult[] }
export function newKrillionRun():KrillionRun { return {phase:'ready',index:0,endsAt:null,draft:'',outcomes:[]} }
export function beginKrillionRound(run:KrillionRun,now:number):KrillionRun { return {...run,phase:'answering',index:run.outcomes.length,endsAt:now+25000,draft:''} }
export function completeKrillionRound(run:KrillionRun,result:KrillionResult):KrillionRun {
  if(run.phase!=='answering'||run.outcomes.length!==run.index)return run
  return {...run,phase:'feedback',endsAt:null,draft:'',outcomes:[...run.outcomes,result]}
}
export function restoreKrillionRun(value:unknown,now:number):KrillionRun {
  const r=value as KrillionRun
  if(!r||!['ready','answering','feedback','done'].includes(r.phase)||!Array.isArray(r.outcomes)||r.outcomes.length>7||!Number.isInteger(r.index)||r.index<0||r.index>6||typeof r.draft!=='string'||r.outcomes.some(o=>typeof o.score!=='number'||o.score<0||o.score>100))return newKrillionRun()
  let run=r
  if(run.phase==='answering'&&run.endsAt!==null&&now>=run.endsAt)run=completeKrillionRound(run,{answer:run.draft,accepted:false,score:0,reason:'The clock expired while you were away.'})
  return run
}
