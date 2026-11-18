import { test, expect } from '@playwright/test'
import { shiftDay, siteDay } from '../src/lib/daily'

test('the day panel and standings show game wins and overall day wins', async ({ page }) => {
  const today = siteDay()
  const row = (name: string, game: string, back: number, score: number) => ({ name, game, day: shiftDay(today, -back), score, stats: {} })
  await page.route('**/api/results**', (route) =>
    route.fulfill({
      json: {
        rows: [
          row('Me', 'connections', 0, 4),
          row('Jon', 'connections', 0, 3),
          row('Me', 'bee', 0, 40),
          row('Jon', 'bee', 0, 90),
          row('Me', 'connections', 1, 2),
          row('Jon', 'connections', 1, 4),
          row('Me', 'bee', 1, 10),
          row('Jon', 'bee', 1, 30),
        ],
      },
    }),
  )
  await page.addInitScript(() => localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Me', group: 'e2e-group' })))

  await page.goto('/leaderboards', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const dayPanel = page.getByRole('region', { name: 'Day results' })
  await expect(dayPanel).toContainText('🏆 Me & Jon', { timeout: 25_000 })
  const standings = page.getByTestId('standings')
  await expect(standings.locator('tbody tr')).toHaveCount(2)
  await expect(standings.locator('tbody tr').first()).toHaveText(/Jon\s*2\s*1\s*3/)
  await expect(standings.locator('tbody tr').last()).toHaveText(/Me\s*2\s*0\s*1/)
})

test('the public leaderboard shows before a name is entered', async ({ page }) => {
  const groups: (string | null)[] = []
  await page.route('**/api/results**', (route) => {
    groups.push(new URL(route.request().url()).searchParams.get('group'))
    return route.fulfill({ json: { rows: [{ name: 'Jon', game: 'connections', day: siteDay(), score: 3, stats: {} }] } })
  })
  await page.goto('/leaderboards', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Add your name' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Jon' })).toBeVisible()
  expect(groups[0]).toBe('public')
})

test('a group code files results on a private board', async ({ page }) => {
  await page.route('**/api/results**', (route) => route.fulfill({ json: { rows: [] } }))
  await page.goto('/leaderboards', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByRole('button', { name: 'Edit leaderboard group' }).click({ timeout: 25_000 })
  await page.getByLabel('Your name', { exact: true }).fill('Tester')
  await page.getByLabel(/Group code/).fill('Our-Group')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('device-player-name')).toHaveText('Tester')
  await expect(page.getByText('group our-group', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sfjc_player') ?? 'null'))).toEqual({ name: 'Tester', group: 'our-group' })
})
