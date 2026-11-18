import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { findTriple } from '../src/lib/triples'
loadEnvConfig(process.cwd())
const base=process.env.VERIFY_DAILY_BASE??'http://127.0.0.1:3117'
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
let pin=''
async function post(path:string,body:object){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
async function main(){
  const created=await post('/api/triples/rooms',{name:'Verify Host'});assert.equal(created.status,200);const a=await created.json();pin=a.room.pin
  const path=`/api/triples/rooms/${pin}`
  assert.equal('deck' in a.room,false)
  const joined=await(await post(path,{action:'join',name:'Verify Guest'})).json()
  assert.equal((await post(path,{action:'start',playerId:joined.playerId})).status,403)
  const started=await(await post(path,{action:'start',playerId:a.playerId})).json()
  const cards=findTriple(started.room.board)!;assert.equal(cards.length,3)
  assert.equal((await post(path,{action:'claim',playerId:a.playerId,cards:[...cards,cards[0]]})).status,400)
  const racing=await Promise.all([a.playerId,joined.playerId].map(playerId=>post(path,{action:'claim',playerId,cards})))
  assert.deepEqual(racing.map(r=>r.status).sort(),[200,409])
  const after=await(await fetch(base+path)).json();assert.equal(after.room.players.reduce((sum:number,p:{score:number})=>sum+p.score,0),1)
  assert.equal((await post(path,{action:'leave',playerId:'not-a-player'})).status,403)
  const left=await(await post(path,{action:'leave',playerId:a.playerId})).json();assert.equal(left.room.hostId,joined.playerId)
  const ended=await(await post(path,{action:'leave',playerId:joined.playerId})).json();assert.equal(ended.room,null)
  assert.equal((await fetch(base+path)).status,404)
  console.log('PASS: create/join, host-only start, hidden deck, strict cards, concurrent claims, host transfer and room cleanup')
}
main().finally(async()=>{if(pin){const r=await admin.from('triples_rooms').delete().eq('pin',pin);if(r.error)throw r.error}}).catch(e=>{console.error(e);process.exitCode=1})
