/** Rarity values observed in the original game's completed-run review. */
export const KRILLION_TIERS = {
  plankton: { name: 'Plankton', score: 10, color: '#93c5d5' },
  tooclever: { name: 'Too Clever', score: 15, color: '#edb6ba' },
  schooler: { name: 'Schooler', score: 30, color: '#78bda9' },
  rare: { name: 'Rare', score: 60, color: '#b2a3da' },
  deepcut: { name: 'Deep Cut', score: 85, color: '#edb96e' },
  krillion: { name: 'One in a Krillion', score: 100, color: '#f0d365' },
} as const
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
