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
export type KrillionJudgment = KrillionResult
export function answerKey(text: string): string { return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') }
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
/** Indexes every normalized answer and alias of a prompt, keeping the first entry on a duplicate key. */
export function answerLookup(answers: KrillionAnswer[]): Map<string, KrillionAnswer> {
  const lookup = new Map<string, KrillionAnswer>()
  for (const entry of answers) for (const alias of [entry.answer, ...entry.aliases ?? []]) {
    const key = answerKey(alias)
    if (key && !lookup.has(key)) lookup.set(key, entry)
  }
  return lookup
}
/**
 * Judges an answer against a prompt's lookup: an exact normalized match, else a silent autocorrect to the single
 * closest answer within 1 edit (keys under 8 letters) or 2 edits, rejecting ties between different answers.
 */
export function judgeWith(lookup: Map<string, KrillionAnswer>, answer: string): KrillionJudgment {
  const key = answerKey(answer)
  let matched = key ? lookup.get(key) : undefined
  if (!matched && key.length >= 4) {
    const max = key.length < 8 ? 1 : 2
    let distance = max + 1, ambiguous = false
    for (const [alias, entry] of lookup) {
      if (Math.abs(alias.length - key.length) > max) continue
      const d = editDistance(key, alias, max)
      if (d < distance) { distance = d; matched = entry; ambiguous = false }
      else if (d === distance && matched?.answer !== entry.answer) ambiguous = true
    }
    if (ambiguous || distance > max) matched = undefined
  }
  if (!matched) return { answer, accepted: false, score: 0, reason: answer.trim() ? 'Not in this prompt’s accepted answer set.' : 'No answer before the clock ran out.' }
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
