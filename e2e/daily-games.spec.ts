import { test, expect, type Page } from '@playwright/test'
import { siteDay, shiftDay } from '../src/lib/daily'
import type { BoardRow } from '../src/lib/results'
import { mockSyncIdentity } from './helpers/sync-identity-mock'
const today = siteDay()
async function scoreMock(page: Page, player = true) {
  await mockSyncIdentity(page)
  const rows: BoardRow[] = []
  if (player)
    await page.addInitScript(() =>
      localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Alice', group: 'daily-e2e' })),
    )
  await page.route('**/api/results**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const b = request.postDataJSON()
      const index = rows.findIndex((r) => r.name === b.name && r.day === b.today && r.game === b.game)
      const row = { name: b.name, day: b.today, game: b.game, score: b.score, stats: b.stats ?? {} }
      if (index < 0) rows.push(row)
      else if (rows[index]!.score < row.score) rows[index] = row
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: { rows } })
  })
  return rows
}
test('Mini solves, saves, restores, navigates dates, and ranks only unassisted play', async ({ page }) => {
  const rows = await scoreMock(page)
  const api = await page.request.get(`/api/daily/mini?d=${today}`)
  const { puzzle } = await api.json()
  await page.goto('/games/mini')
  const boxes = page.getByRole('textbox', { name: /^Row/ })
  await expect(boxes.first()).toBeVisible()
  await boxes.first().fill(puzzle.cells.find(Boolean))
  await page.reload()
  await page.getByRole('button', { name: 'Continue puzzle', exact: true }).click()
  await expect(boxes.first()).toHaveValue(puzzle.cells.find(Boolean))
  for (let i = 0; i < puzzle.cells.length; i++)
    if (puzzle.cells[i])
      await page
        .getByRole('textbox', {
          name: new RegExp(`^Row ${Math.floor(i / puzzle.width) + 1}, column ${(i % puzzle.width) + 1}(,|$)`),
        })
        .fill(puzzle.cells[i])
  await expect(page.getByTestId('mini-result')).toBeVisible()
  await expect.poll(() => rows.find((r) => r.game === 'mini')?.stats.solved).toBe(true)
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(shiftDay(today, -1)))
  await page.getByRole('button', { name: 'Reveal ▾', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Puzzle', exact: true }).click()
  await expect(page.getByTestId('mini-result')).toContainText('Assisted · not ranked')
  expect(rows.filter((r) => r.game === 'mini')).toHaveLength(1)
  await page.goto(`/games/mini?d=${shiftDay(today, 1)}`)
  await expect(page.getByText('Future preview · practice only, not ranked')).toBeVisible()
})
test('Connections full daily solve syncs and survives reload', async ({ page }) => {
  const rows = await scoreMock(page)
  const { puzzle } = await (await page.request.get(`/api/daily/connections?d=${today}`)).json()
  await page.goto('/games/connections/daily')
  for (const group of puzzle.groups) {
    for (const word of group.words) await page.getByRole('button', { name: word, exact: true }).click()
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
  }
  await expect(page.getByTestId('connections-result')).toBeVisible()
  await expect.poll(() => rows.find((r) => r.game === 'connections')?.score).toBe(4)
  await page.reload()
  await expect(page.getByTestId('connections-result')).toBeVisible()
  await expect(page.getByTestId('connections-revealed-group')).toHaveCount(4)
})
test('historical Bee answers earn points and appear in calendar with no 24 board', async ({ page }) => {
  const rows = await scoreMock(page)
  const { puzzle } = await (await page.request.get(`/api/daily/bee?d=${today}`)).json()
  await page.goto('/games/spelling-bee')
  await expect(page.getByRole('heading', { name: 'Spelling Bee', exact: true })).toBeVisible()
  await page.keyboard.type(puzzle.answers[0])
  await page.keyboard.press('Enter')
  await expect.poll(() => rows.find((r) => r.game === 'bee')?.score ?? 0).toBeGreaterThan(0)
  rows.push({ name: 'Bob', game: 'bee', day: today, score: 1, stats: { n: 1 } })
  await page.goto('/leaderboards')
  await expect(page.getByRole('region', { name: 'Day results' })).toContainText('Alice')
  await page.getByRole('combobox', { name: 'Game', exact: true }).selectOption('bee')
  await page.getByRole('button', { name: 'Standings', exact: true }).click()
  await expect(page.getByTestId('board-bee')).toContainText('Alice')
  await page.getByRole('button', { name: 'Your stats', exact: true }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${today}, Alice, Bob`) })).toBeVisible()
  await page.getByRole('button', { name: 'Wins', exact: true }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${today}, Alice won 1`) })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Game', exact: true }).locator('option')).toHaveCount(7)
  await expect(page.getByRole('link', { name: '24', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await page.getByText('Your stats', { exact: true }).click()
  await expect(page.getByRole('img', { name: 'Your last 14 days', exact: true })).toBeVisible()
})
test('Anthropeum completes ten artifacts and syncs its result', async ({ page }) => {
  const rows = await scoreMock(page)
  const { puzzle } = await (await page.request.get(`/api/daily/anthropeum?d=${today}`)).json()
  const buckets = Array<number>(50).fill(0)
  buckets[25] = 2
  buckets[39] = 3
  const roundSums = Object.fromEntries(puzzle.artifacts.map((a: { id: number }) => [a.id, 32000]))
  await page.route('**/api/anthropeum/distribution?*', (route) =>
    route.fulfill({ json: { buckets, totalPlayers: 5, roundSums, roundPlayers: 4 } }),
  )
  rows.push({ name: 'Bob', game: 'anthropeum', day: today, score: 49000, stats: {} })
  await page.goto('/games/anthropeum')
  await page.getByRole('button', { name: 'Play today’s game', exact: true }).click()
  for (let i = 0; i < 10; i++) {
    const a = puzzle.artifacts[i]
    await page.getByText('Precise coordinates and date', { exact: true }).click()
    await page.getByLabel('Latitude', { exact: true }).fill(String(a.target.lat))
    await page.getByLabel('Longitude', { exact: true }).fill(String(a.target.lon))
    await page.getByLabel('Period start', { exact: true }).fill(String(Math.floor((a.beginYear + a.endYear) / 2)))
    await page.getByRole('button', { name: 'Lock in guess', exact: true }).click()
    await page.getByRole('button', { name: i < 9 ? 'Next artifact →' : 'See final score', exact: true }).click()
  }
  await expect(page.getByTestId('anthropeum-result')).toBeVisible()
  await expect.poll(() => rows.find((r) => r.game === 'anthropeum' && r.name === 'Alice')?.stats.solved).toBe(true)
  await expect(page.getByRole('group', { name: 'Original Anthropeum player score distribution' })).toBeVisible()
  await expect(page.getByText('Player average 8,000').first()).toBeVisible()
  await expect(page.getByRole('row', { name: /Bob/ })).toContainText('49,000')
  await expect(page.getByRole('row', { name: /Alice/ })).toContainText('(you)')
  await page.reload()
  await expect(page.getByTestId('anthropeum-result')).toBeVisible()
})
test('Krillion same-day dive uses official scores and unlocks the full answer review', async ({ page }) => {
  const rows = await scoreMock(page)
  await page.clock.install({ time: new Date('2026-11-17T20:00:00Z') })
  await page.goto('/games/krillion?d=2026-11-17')
  await expect(page.locator('input[type=date]')).toHaveValue('2026-11-17')
  await expect(page.getByTestId('krillion-review')).toHaveCount(0)
  await page.getByRole('button', { name: 'Begin dive', exact: true }).click()
  for (const [index, answer] of [
    'Zootopia',
    'Taco',
    'Rhinoceros',
    'Michael Jordan',
    'Louisville',
    'Apple',
    'Jett',
  ].entries()) {
    await page.clock.runFor(3100)
    await page.getByLabel('Your answer', { exact: true }).fill(answer)
    await page.getByRole('button', { name: 'Dive · submit answer', exact: true }).click()
    await page.getByRole('button', { name: index < 6 ? 'DESCEND ▼' : 'SURFACE ▲', exact: true }).click()
  }
  await expect(page.getByTestId('krillion-result').locator('.krillion-done-score strong')).toHaveText('90')
  await expect.poll(() => rows.find((r) => r.game === 'krillion')?.score).toBe(90)
  await page.getByRole('textbox', { name: 'Search accepted answers' }).fill('Zootopia')
  await page.clock.runFor(300)
  await expect(page.getByTestId('krillion-review')).toContainText('Zootopia')
  await expect(page.getByTestId('krillion-review')).toContainText('Plankton · 10')
  await page.reload()
  await expect(page.getByTestId('krillion-result')).toBeVisible()
})
test('score delivery retries after a transient server failure', async ({ page }) => {
  let requests = 0
  const rows = await scoreMock(page)
  await page.route('**/api/results', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    requests++
    if (requests === 1) return route.fulfill({ status: 503, json: { error: 'Temporary outage' } })
    return route.fallback()
  })
  const { puzzle } = await (await page.request.get(`/api/daily/bee?d=${today}`)).json()
  await page.goto('/games/spelling-bee')
  await expect(page.getByRole('heading', { name: 'Spelling Bee', exact: true })).toBeVisible()
  await page.keyboard.type(puzzle.answers[0])
  await page.keyboard.press('Enter')
  await expect.poll(() => requests).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => rows.find((r) => r.game === 'bee')?.score ?? 0).toBeGreaterThan(0)
})

test('guest result queues until a name is saved', async ({ page }) => {
  const rows = await scoreMock(page, false)
  const { puzzle } = await (await page.request.get(`/api/daily/bee?d=${today}`)).json()
  await page.goto('/games/spelling-bee')
  await expect(page.getByRole('heading', { name: 'Spelling Bee', exact: true })).toBeVisible()
  await page.keyboard.type(puzzle.answers[0])
  await page.keyboard.press('Enter')
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sfjc_results_queue_v2') ?? '[]').length))
    .toBe(1)
  expect(rows).toHaveLength(0)
  await page.goto('/leaderboards')
  await page.getByRole('button', { name: 'Add your name', exact: true }).click()
  await page.getByLabel('Your name', { exact: true }).fill('GuestPlayer')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => rows.find((r) => r.name === 'GuestPlayer')?.score ?? 0).toBeGreaterThan(0)
})
test('Krillion rejects can be retried; reload keeps the deadline and expiry submits the draft', async ({ page }) => {
  await scoreMock(page)
  await page.clock.install({ time: new Date('2026-11-17T20:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-17T20:00:00Z'))
  await page.goto('/games/krillion?d=2026-11-17')
  await page.getByRole('button', { name: 'Begin dive', exact: true }).click()
  await page.clock.runFor(3100)
  await page.getByLabel('Your answer', { exact: true }).fill('qzxqzxqzxqzx')
  await page.getByRole('button', { name: 'Dive · submit answer', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/try again/i)
  await expect(page.getByRole('button', { name: 'DESCEND ▼' })).toHaveCount(0)
  await page.clock.runFor(4000)
  const remaining = await page.getByRole('timer').innerText()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(remaining)
  await page.getByLabel('Your answer', { exact: true }).fill('Zootopia')
  await page.clock.runFor(26000)
  await expect(page.getByRole('status')).toContainText('PLANKTON')
  await expect(page.getByRole('status')).toContainText('+10 PTS')
})
test('historical Bee hives stay practice and never post daily scores', async ({ page }) => {
  const rows = await scoreMock(page)
  await page.goto('/games/spelling-bee?a=2023-01-01')
  await expect(page.getByText('Past hive · 2023-01-01 · practice')).toBeVisible()
  await page.keyboard.type('acne')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'acne', exact: true })).toBeVisible()
  await page.waitForTimeout(1800)
  expect(rows).toHaveLength(0)
})

test('a future preview never becomes a ranked result after its date arrives', async ({ page }) => {
  const rows = await scoreMock(page)
  await page.clock.install({ time: new Date('2026-11-16T20:00:00Z') })
  const { puzzle } = await (await page.request.get('/api/daily/mini?d=2026-11-17')).json()
  await page.goto('/games/mini?d=2026-11-17')
  await page.getByRole('textbox', { name: /^Row/ }).first().fill(puzzle.cells.find(Boolean))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sfjc_future_practice:mini:2026-11-17'))).toBe('1')
  await page.getByRole('button', { name: 'Pause puzzle', exact: true }).click()
  await page.clock.setFixedTime(new Date('2026-11-17T20:00:00Z'))
  await page.reload()
  await page.getByRole('button', { name: 'Continue puzzle', exact: true }).click()
  for (let i = 0; i < puzzle.cells.length; i++)
    if (puzzle.cells[i])
      await page
        .getByRole('textbox', {
          name: new RegExp(`^Row ${Math.floor(i / puzzle.width) + 1}, column ${(i % puzzle.width) + 1}(,|$)`),
        })
        .fill(puzzle.cells[i])
  await expect(page.getByTestId('mini-result')).toBeVisible()
  await page.waitForTimeout(300)
  expect(rows).toHaveLength(0)
})

test('Mini pause and leaving freeze the clock; Tab changes clues and scoped checks stay unranked', async ({ page }) => {
  const rows = await scoreMock(page)
  await page.clock.install({ time: new Date('2026-11-17T20:00:00Z') })
  await page.goto('/games/mini?d=2026-11-17')
  await expect(page.getByRole('textbox', { name: /^Row/ }).first()).toBeVisible()
  await page.clock.runFor(5100)
  await page.getByRole('button', { name: 'Pause puzzle', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Row/ })).toHaveCount(0)
  await page.clock.runFor(60000)
  await expect(page.getByRole('button', { name: 'Resume puzzle', exact: true })).toContainText('0:05')
  await page.getByRole('button', { name: 'Continue puzzle', exact: true }).click()
  await page.clock.runFor(2000)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Continue puzzle', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume puzzle', exact: true })).toContainText('0:07')
  await page.getByRole('button', { name: 'Continue puzzle', exact: true }).click()
  await page.getByRole('textbox', { name: /^Row/ }).first().focus()
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: 'Reveal ▾', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Square', exact: true }).click()
  await expect(page.getByText('Assisted · not ranked', { exact: true })).toBeVisible()
  const filled = await page
    .getByRole('textbox', { name: /^Row/ })
    .evaluateAll((es) => es.filter((e) => (e as HTMLInputElement).value).length)
  expect(filled).toBe(1)
  expect(rows).toHaveLength(0)
})

test('an idle daily page switches puzzle at Pacific midnight and retries a late feed', async ({ page }) => {
  await scoreMock(page)
  const before = '2026-11-19'
  const after = '2026-11-20'
  let requested = 0
  await page.clock.install({ time: new Date(`${after}T07:59:50Z`) })
  await page.clock.pauseAt(new Date(`${after}T07:59:55Z`))
  await page.route('**/api/daily/fivefold?*', async (route) => {
    const date = new URL(route.request().url()).searchParams.get('d')
    if (date === after && ++requested === 1) return route.fulfill({ status: 503, json: { error: 'Puzzle delayed' } })
    return route.fulfill({ json: { day: date, sourceDate: date, puzzle: { date, answer: 'arose', id: 1, number: 1 } } })
  })
  await page.goto('/games/wordle')
  const picker = page.locator('input[type=date]').first()
  await expect(picker).toHaveValue(before)
  await page.clock.runFor(5100)
  await expect(picker).toHaveValue(after)
  const error = page.getByRole('alert').filter({ hasText: 'Puzzle delayed' })
  await expect(error).toBeVisible()
  await page.clock.runFor(60000)
  await expect(error).toHaveCount(0)
  expect(requested).toBe(2)
  await page.goto(`/games/wordle?d=${before}`)
  await expect(picker).toHaveValue(before)
})

test('a daily game in progress keeps its date across midnight', async ({ page }) => {
  await scoreMock(page)
  await page.clock.install({ time: new Date('2026-11-20T07:59:45Z') })
  await page.clock.pauseAt(new Date('2026-11-20T07:59:55Z'))
  await page.route('**/api/daily/fivefold?*', (route) => {
    const day = new URL(route.request().url()).searchParams.get('d')
    return route.fulfill({ json: { day, sourceDate: day, puzzle: { date: day, answer: 'arose', id: 1, number: 1 } } })
  })
  await page.goto('/games/wordle')
  const picker = page.locator('input[type=date]').first()
  await expect(picker).toHaveValue('2026-11-19')
  await expect(page.getByRole('button', { name: 'Enter', exact: true })).toBeVisible()
  await page.keyboard.type('aros')
  await page.clock.runFor(5100)
  await expect(picker).toHaveValue('2026-11-19')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(picker).toHaveValue('2026-11-20')
})
