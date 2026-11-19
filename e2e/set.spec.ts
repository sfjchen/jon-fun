import { test, expect } from '@playwright/test'
import { dailySetBoard, allSets } from '../src/lib/set-daily'
import { siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'
const day=siteDay()
test('SET puzzle solves six unique sets, restores progress and stays off the daily board',async({page})=>{
  await mockSyncIdentity(page)
  const results:Record<string,unknown>[]=[]
  await page.addInitScript(()=>localStorage.setItem('sfjc_player',JSON.stringify({name:'SetPlayer',group:'set-test'})))
  await page.route('**/api/results**',async route=>{if(route.request().method()==='POST')results.push(route.request().postDataJSON());await route.fulfill({json:{ok:true,rows:[]}})})
  await page.goto('/games/set')
  await page.getByRole('button',{name:'Play daily puzzle'}).click()
  const sets=allSets(dailySetBoard(day)),board=page.getByTestId('set-play').locator('button[data-card]')
  for(const c of sets[0]!)await board.filter({has:page.locator(`svg`)}).and(page.locator(`[data-card="${c}"]`)).first().click()
  await expect(page.getByText('1 / 6 sets found',{exact:true})).toBeVisible()
  for(const c of sets[0]!)await page.locator(`[data-card="${c}"]`).first().click()
  await expect(page.getByRole('status')).toHaveText('You already found that set.')
  await page.reload();await page.getByRole('button',{name:'Continue puzzle'}).click()
  for(const cards of sets.slice(1))for(const c of cards)await page.locator(`[data-card="${c}"]`).first().click()
  await expect(page.getByTestId('set-result')).toContainText('All six sets found')
  expect(results).toHaveLength(0)
  await page.reload();await expect(page.getByTestId('set-result')).toBeVisible()
})
test('SET hints show and Home aligns with controls on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mockSyncIdentity(page)
  const posts:unknown[]=[]
  await page.route('**/api/results**',async route=>{if(route.request().method()==='POST')posts.push(route.request().postDataJSON());await route.fulfill({json:{rows:[],ok:true}})})
  await page.goto('/games/set');await page.getByRole('button',{name:'Play daily puzzle'}).click();await page.getByRole('button',{name:'Hint',exact:true}).click()
  for(const cards of allSets(dailySetBoard(day)))for(const c of cards)await page.locator(`[data-card="${c}"]`).first().click()
  await expect(page.getByTestId('set-result')).toContainText('With hints');expect(posts).toHaveLength(0)
  const home=await page.getByRole('link',{name:'Home',exact:true}).boundingBox(),scores=await page.getByRole('link',{name:'Leaderboard',exact:true}).boundingBox()
  expect(Math.abs(home!.y+home!.height/2-scores!.y-scores!.height/2)).toBeLessThan(3)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
})
test('direct cookie recovery supersedes stale lobby fallbacks while typed drafts remain untouched',async({page})=>{
  for(const route of ['/games/24','/games/quip-clash','/games/triples?pin=1234']){
    await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('triples_name','Old room name');sessionStorage.setItem('game24_playerName','Old room name');sessionStorage.setItem('party_quiplash_playerName','Old room name')})
    await page.route('**/api/sync/identity',async r=>{if(r.request().method()==='GET'){await new Promise(resolve=>setTimeout(resolve,400));await r.fulfill({json:{syncKey:'',deviceId:'12345678-1234-4123-a123-123456789012',player:{name:'Restored Alice',group:'public'}}})}else await r.fulfill({json:{syncKey:'',player:{name:'Restored Alice',group:'public'}}})})
    await page.goto(route)
    const field=route.includes('triples')?page.getByRole('textbox',{name:'Your name',exact:true}):page.getByPlaceholder(route.includes('/24')?'Enter your name':'Your name',{exact:true})
    await expect(field).toHaveValue('Restored Alice');await field.fill('My typed name')
    await page.evaluate(()=>{localStorage.setItem('sfjc_player',JSON.stringify({name:'Different Alice',group:'public'}));dispatchEvent(new Event('sfjc-player-changed'))})
    await expect(field).toHaveValue('My typed name')
    await page.unroute('**/api/sync/identity')
  }
})
test('existing saved game name immediately replaces stale Notes label',async({page})=>{
  await mockSyncIdentity(page)
  await page.addInitScript(()=>{localStorage.setItem('sfjc_player',JSON.stringify({name:'Current Alice',group:'public'}));localStorage.setItem('sfjc_device_label','Old label')})
  await page.goto('/games/daily-log')
  await expect(page.getByTestId('device-player-name').first()).toContainText('Current Alice')
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('sfjc_device_label'))).toBe('Current Alice')
})

test('full-deck practice can finish and multiplayer players see the same successful claim',async({page,context})=>{
  test.setTimeout(180000)
  await mockSyncIdentity(page)
  await page.addInitScript(()=>localStorage.setItem('sfjc_player',JSON.stringify({name:'Set Host',group:'set-test'})))
  await page.goto('/games/triples',{waitUntil:'domcontentloaded'})
  // Clear every available set in solo mode; replacements must never duplicate cards.
  const {findTriple}=await import('../src/lib/triples')
  await expect(page.locator('button[data-card]').first()).toBeVisible()
  for(let i=0;i<28;i++){
    const cards=await page.locator('button[data-card]:enabled').evaluateAll(es=>es.map(e=>Number(e.getAttribute('data-card'))))
    if(!cards.length)break
    expect(new Set(cards).size).toBe(cards.length)
    const triple=findTriple(cards)
    if(!triple)break
    for(const c of triple)await page.locator(`[data-card="${c}"]`).click()
  }
  await expect(page.getByText(/Deck cleared in/)).toBeVisible()
  await page.getByRole('tab',{name:'With friends',exact:true}).click()
  await page.goto('/games/triples?pin=1234',{waitUntil:'domcontentloaded'})
  const created=page.waitForResponse(r=>r.url().endsWith('/api/triples/rooms')&&r.request().method()==='POST')
  await page.getByRole('button',{name:'Create a room',exact:true}).click()
  const host=await(await created).json(),pin=host.room.pin
  await expect(page).toHaveURL(new RegExp(`pin=${pin}`))
  await page.getByRole('tab',{name:'Solo',exact:true}).click()
  await page.getByRole('tab',{name:'With friends',exact:true}).click()
  await expect(page.getByRole('list',{name:'Scores'})).toContainText('Set Host')
  const guest=await context.newPage();let guestId='',guestToken=''
  try{
    await mockSyncIdentity(guest)
    await guest.addInitScript(()=>localStorage.setItem('sfjc_player',JSON.stringify({name:'Set Guest',group:'set-test'})))
    await guest.goto(`/games/triples?pin=${pin}`,{waitUntil:'domcontentloaded'})
    const joined=guest.waitForResponse(r=>r.url().endsWith(`/api/triples/rooms/${pin}`)&&r.request().method()==='POST')
    await guest.getByRole('button',{name:'Join',exact:true}).click()
    const joinedData=await(await joined).json();guestId=joinedData.playerId;guestToken=joinedData.playerToken
    await expect(page.getByRole('list',{name:'Scores'})).toContainText('Set Guest')
    await page.getByRole('button',{name:'Start game',exact:true}).click()
    await expect(guest.locator('button[data-card]').first()).toBeVisible()
    const room=await(await page.request.get(`/api/triples/rooms/${pin}`)).json()
    for(const c of findTriple(room.room.board)!)await page.locator(`[data-card="${c}"]`).click()
    await expect(page.getByRole('list',{name:'Scores'})).toContainText('Set Host 1')
    await expect(guest.getByRole('list',{name:'Scores'})).toContainText('Set Host 1')
    await page.reload();await expect(page.getByRole('list',{name:'Scores'})).toContainText('Set Host 1')
  }finally{
    if(guestId)await page.request.post(`/api/triples/rooms/${pin}`,{data:{action:'leave',playerId:guestId,playerToken:guestToken}})
    await page.request.post(`/api/triples/rooms/${pin}`,{data:{action:'leave',playerId:host.playerId,playerToken:host.playerToken}})
    await guest.close()
  }
})


test('temporary room failures retain the seat and a different invite opens its requested lobby',async({page})=>{
  await mockSyncIdentity(page)
  await page.addInitScript(()=>{sessionStorage.setItem('triples_session',JSON.stringify({pin:'1234',playerId:'host',playerToken:'private-seat'}));localStorage.setItem('sfjc_player',JSON.stringify({name:'Alice',group:'public'}))})
  let reads=0
  await page.route('**/api/triples/rooms/1234',async route=>{reads++;if(reads===1)return route.fulfill({status:503,json:{error:'Temporary storage failure'}});return route.fulfill({json:{room:{pin:'1234',hostId:'host',status:'waiting',board:[],deckCount:0,players:[{id:'host',name:'Alice',score:0,misses:0}],lastClaim:null,version:0,startedAt:null}}})})
  await page.goto('/games/triples',{waitUntil:'domcontentloaded'})
  await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeVisible()
  expect(reads).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('triples_session')!).playerId)).toBe('host')
  await page.goto('/games/triples?pin=5678',{waitUntil:'domcontentloaded'})
  await expect(page.getByRole('textbox',{name:'Room PIN'})).toHaveValue('5678')
  await expect(page.getByRole('button',{name:'Join',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('triples_session')!).pin)).toBe('1234')
})
