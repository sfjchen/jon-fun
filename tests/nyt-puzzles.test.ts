import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNytPuzzle } from '../src/lib/daily/nyt-puzzles'

const date = '2026-11-19'
test('Wordle uses publication date and puzzle number, never answer-list rotation', () => {
  assert.deepEqual(normalizeNytPuzzle('fivefold', { print_date: date, solution: 'clout', id: 1555, days_since_launch: 1979 }, date), { date, answer: 'clout', id: 1555, number: 1979, editor: '' })
  assert.throws(() => normalizeNytPuzzle('fivefold', { print_date: '2026-11-18', solution: 'blurt', id: 1, days_since_launch: 1978 }, date))
})
test('Bee keeps the exact accepted words and validates pangrams and center letter', () => {
  const p = { print_date: date, center_letter: 'k', outer_letters: 'cdelnu', answers: ['clunked','duck'], pangrams: ['clunked','knuckled'] }
  const result = normalizeNytPuzzle('bee',p,date)
  assert('max' in result && result.max === 30)
  assert('answers' in result && result.answers.length === 3)
  assert.throws(() => normalizeNytPuzzle('bee',{...p,answers:[...p.answers,'alien']},date))
  assert.throws(() => normalizeNytPuzzle('bee',{...p,pangrams:[]},date))
  const separatePangram = normalizeNytPuzzle('bee', { ...p, answers: ['duck'] }, date)
  assert('answers' in separatePangram && 'max' in separatePangram)
  assert.deepEqual(separatePangram.answers, ['clunked','duck','knuckled'])
  assert.equal(separatePangram.max, 30)
})
test('Mini preserves grid crossings, clue directions, rebuses and exact clue text', () => {
  const p = { publicationDate: date, id: 1, body: [{ dimensions: { width: 2, height: 1 }, cells: [{answer:'TH'},{answer:'E'}], clues: [{label:'1',direction:'Across',cells:[0,1],text:[{plain:'First '},{plain:'clue'}]}] }] }
  const result = normalizeNytPuzzle('mini',p,date)
  assert('clues' in result && result.clues[0]?.answer === 'THE' && result.clues[0]?.text === 'First clue')
  assert.throws(() => normalizeNytPuzzle('mini',{...p,publicationDate:'2026-11-18'},date))
})
test('Connections retains official category levels and the original 16 tile positions', () => {
  const categories = Array.from({length:4},(_,i)=>({title:`Group ${i}`,cards:Array.from({length:4},(_,j)=>({content:`Word ${i*4+j}`,position:15-i*4-j}))}))
  const result = normalizeNytPuzzle('connections',{print_date:date,categories},date)
  assert('startingWords' in result && result.startingWords[0] === 'Word 15')
  assert('groups' in result && result.groups[0]?.difficulty === 'yellow' && result.groups[3]?.difficulty === 'purple')
  categories[0]!.cards[0]!.position = 0
  assert.throws(() => normalizeNytPuzzle('connections',{print_date:date,categories},date))
})

import { hintsRemaining, revealArtifactHint, artifactHintText } from '../src/lib/artifact-hints'
import { winners } from '../src/lib/score-stats'

test('Anthropeum hints share a three-hint daily budget, do not repeat, and give the original millennium span',()=>{
 let hints={}
 hints=revealArtifactHint(hints,0,'time');hints=revealArtifactHint(hints,0,'time')
 assert.equal(hintsRemaining(hints),2)
 hints=revealArtifactHint(hints,0,'place');hints=revealArtifactHint(hints,1,'time')
 assert.equal(hintsRemaining(hints),0)
 assert.deepEqual(revealArtifactHint(hints,2,'place'),hints)
 assert.equal(artifactHintText({beginYear:1250,endYear:1350} as never,'time'),'1000 CE – 2000 CE')
})
test('Connections only ranks completed times; word counts never outrank Bee points',()=>{
 const row={name:'Fast',game:'connections' as const,day:date,score:4,stats:{seconds:80,mistakes:3}}
 assert.deepEqual(winners([row,{...row,name:'Careful',stats:{seconds:100,mistakes:0}}]),['Fast'])
 assert.deepEqual(winners([{...row,score:3},{...row,name:'Other',score:2}]),[])
 assert.deepEqual(winners([{...row,game:'bee',score:10,stats:{n:2}},{...row,game:'bee',name:'Other',score:8,stats:{n:8}}]),['Fast'])
})

import { nextSiteMidnight } from '../src/lib/daily'
import { anthropeumDistributionSchema, anthropeumPlacement } from '../src/lib/daily/anthropeum-stats'

test('Pacific rollover uses the new day offset on both daylight-saving transitions', () => {
  for (const [now, midnight] of [
    ['2026-03-08T20:00:00Z', '2026-03-09T07:00:00Z'],
    ['2026-11-01T20:00:00Z', '2026-11-02T08:00:00Z'],
  ]) assert.equal(nextSiteMidnight(new Date(now!)), Date.parse(midnight!))
})

test('Anthropeum estimates placement by the midpoint of the score bucket', () => {
  const buckets = Array<number>(50).fill(0)
  buckets[0] = 3
  buckets[48] = 5
  buckets[49] = 2
  const data = { buckets, totalPlayers: 10, roundSums: { '3': 8000 }, roundPlayers: 1 }
  assert(anthropeumDistributionSchema.safeParse(data).success)
  assert.equal(anthropeumPlacement(data, 100000)?.top, 10)
  assert.equal(anthropeumPlacement(data, 100000)?.bucket, 49)
  assert.equal(anthropeumPlacement(data, 97000)?.top, 45)
  assert(!anthropeumDistributionSchema.safeParse({ ...data, totalPlayers: 11 }).success)
})
