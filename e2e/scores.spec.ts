import { test, expect } from '@playwright/test'

test('day by day shows each game winner and the overall tally', async ({ page }) => {
  const day = (back: number) => {
    const d = new Date(Date.now() - back * 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const row = (name: string, game: string, back: number, score: number) => ({ name, game, day: day(back), score, stats: {} })
  await page.route('**/api/results**', (route) =>
    route.fulfill({
      json: {
        rows: [
          row('Me', 'connections', 0, 100),
          row('Jon', 'connections', 0, 60),
          row('Me', 'bee', 0, 40),
          row('Jon', 'bee', 0, 90),
          row('Me', 'connections', 1, 20),
          row('Jon', 'connections', 1, 80),
          row('Me', 'bee', 1, 10),
          row('Jon', 'bee', 1, 30),
        ],
      },
    }),
  )
  await page.addInitScript(() => localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Me', group: 'e2e-group' })))

  await page.goto('/leaderboards', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const section = page.getByTestId('scores-day-by-day')
  await expect(section).toBeVisible({ timeout: 25_000 })
  await expect(section).toContainText('Days won overall: Jon 1')
  const rows = section.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).locator('td').last()).toHaveText('Tie')
  await expect(rows.nth(1).locator('td').last()).toHaveText('Jon')
})

test('the public leaderboard shows before a name is entered', async ({ page }) => {
  const groups: (string | null)[] = []
  await page.route('**/api/results**', (route) => {
    groups.push(new URL(route.request().url()).searchParams.get('group'))
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return route.fulfill({ json: { rows: [{ name: 'Jon', game: 'connections', day, score: 80, stats: {} }] } })
  })
  await page.goto('/leaderboards', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Jon' })).toBeVisible()
  expect(groups[0]).toBe('public')
})
