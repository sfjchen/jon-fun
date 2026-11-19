/** Run against a configured local server. Uses an isolated group and removes its rows afterwards. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { siteDay, shiftDay, validDay, archiveDay } from '../src/lib/daily'
import { overallDay, streaks, winners, winsByPlayer } from '../src/lib/score-stats'
import { scoringVersion, type GameId, type BoardRow } from '../src/lib/results'
loadEnvConfig(process.cwd())
const base = process.env.VERIFY_DAILY_BASE ?? 'http://127.0.0.1:3117'
const group = `verify-${randomUUID().slice(0,8)}`
const deviceId = randomUUID()
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const today = siteDay()
async function post(score:number,game='connections',day=today,extra:Record<string,unknown>={}) {
  return fetch(`${base}/api/results`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group,deviceId,name:'Verification',game,today:day,score,stats:{solved:true,scoringVersion:scoringVersion(game as GameId),...(game==='mini'?{seconds:score}:{}),...(game==='connections'?{n:score,mistakes:2}:{}),...extra}})})
}
async function main() {
  assert.equal(validDay('2026-02-30'),false)
  assert.equal(validDay('2024-02-29'),true)
  assert.equal(shiftDay('2026-03-08',1),'2026-03-09')
  assert.equal(archiveDay('2026-11-16',['2026-11-15','2026-11-16']),'2026-11-16')
  assert.equal((await post(50,'24')).status,400)
  assert.equal((await post(50,'connections',shiftDay(today,1))).status,400)
  assert.equal((await post(50,'connections','2026-02-30')).status,400)
  const responses=await Promise.all([1,4,3,2].map(n=>post(n)))
  assert.ok(responses.every(r=>r.ok),'Concurrent score requests should succeed')
  for(const game of ['mini','bee','anthropeum','krillion'])assert.ok((await post(100,game)).ok,`${game} should sync`)
  assert.equal((await post(6,'set')).status,400,'SET requires a completion time')
  assert.ok((await post(4,'fivefold',today,{seconds:100})).ok)
  assert.ok((await post(5,'fivefold',today,{seconds:50})).ok)
  assert.ok((await post(3,'connections',shiftDay(today,-1))).ok,'Past daily scores should sync to their own day')
  assert.ok((await post(50,'mini')).ok)
  assert.ok((await post(4,'connections',today,{mistakes:0})).ok)
  assert.ok((await post(1000,'krillion',today,{scoringVersion:1})).ok)
  const data=await(await fetch(`${base}/api/results?group=${group}&days=4000`)).json() as {rows:BoardRow[];legacyRows:BoardRow[]}
  assert.equal(data.rows.find(r=>r.game==='connections'&&r.day===today)?.score,4,'Best score must survive concurrent writes')
  assert.equal(data.rows.length,7)
  assert.equal(data.rows.find(r=>r.game==='fivefold')?.stats.seconds,100,'Fivefold retains the first result')
  assert.equal(data.rows.find(r=>r.game==='mini')?.score,100,'First Mini solve must not be replaced by a faster replay')
  assert.equal(data.rows.find(r=>r.game==='connections'&&r.day===today)?.stats.mistakes,0)
  assert.equal(data.legacyRows.length,1,'Earlier scoring stays separate')
  const privateRows=await(await fetch(`${base}/api/results?group=${group}-other&days=4000`)).json() as {rows:BoardRow[]}
  assert.equal(privateRows.rows.length,0)
  const example:BoardRow[]=[{name:'Alice',game:'bee',day:today,score:10,stats:{}},{name:'Bob',game:'bee',day:today,score:10,stats:{}}]
  assert.deepEqual(winners(example),['Alice','Bob'])
  assert.deepEqual(winners(example.slice(0,1)),[])
  assert.equal(winsByPlayer(example).get('Alice'),1)
  assert.deepEqual(overallDay(example).names,['Alice','Bob'])
  assert.deepEqual(overallDay([...example,{...example[0]!,game:'anthropeum',score:20},{...example[1]!,game:'anthropeum',score:10}]).names,['Alice'])
  assert.deepEqual(streaks([example[0]!,{...example[0]!,day:shiftDay(today,-1)}],today),{current:2,longest:2})
  assert.deepEqual(winners([{...example[0]!,game:'mini',score:0},{...example[1]!,game:'mini',score:30}]),['Alice'])
  const deviceRows=await client.from('game_results').select('device_id').eq('group_code',group)
  assert.equal(deviceRows.error,null)
  assert.ok(deviceRows.data!.length>0&&deviceRows.data!.every(r=>r.device_id===deviceId))
  console.log('PASS: dates, archive selection, ties, streaks, six real database score flows, history, group isolation, atomic best score, and future/24 rejection')
}
main().finally(async()=>{const result=await client.from('game_results').delete().eq('group_code',group);if(result.error)throw Error('Could not remove isolated verification rows')}).catch(e=>{console.error(e.message);process.exitCode=1})
