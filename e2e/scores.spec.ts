import { test, expect } from '@playwright/test'
import { siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('clean leaderboard compares Connections by time and Wordle by guesses, with shared ties', async ({ page }) => {
  await mockSyncIdentity(page)
  const day = siteDay()
  await page.addInitScript(() =>
    localStorage.setItem('sfjc_player', JSON.stringify({ name: 'Me', group: 'e2e-group' })),
  )
  await page.route('**/api/results**', (r) =>
    r.fulfill({
      json: {
        rows: [
          { name: 'Me', game: 'connections', day, score: 4, stats: { solved: true, seconds: 90, mistakes: 3 } },
          { name: 'Jon', game: 'connections', day, score: 4, stats: { solved: true, seconds: 120, mistakes: 0 } },
          { name: 'Me', game: 'fivefold', day, score: 4, stats: { solved: true, seconds: 90 } },
          { name: 'Jon', game: 'fivefold', day, score: 4, stats: { solved: true, seconds: 30 } },
        ],
      },
    }),
  )
  await page.goto('/leaderboards')
  await expect(page.getByRole('region', { name: 'Calendar' })).toBeHidden()
  await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible()
  await page.getByRole('button', { name: 'Connections', exact: true }).click()
  const dayResults = page.getByRole('region', { name: 'Day results' })
  await expect(dayResults.getByRole('listitem').first()).toContainText('Me')
  await expect(dayResults.getByRole('listitem').first()).toContainText('1:30')
  await expect(dayResults.getByRole('listitem').first().getByLabel('Daily winner')).toBeVisible()
  await page.getByRole('button', { name: 'Wordle', exact: true }).click()
  await expect(dayResults.getByLabel('Daily winner')).toHaveCount(2)
  await expect(dayResults.getByRole('listitem').first()).toContainText('3/6')
  await expect(page.getByTestId('board-fivefold').getByRole('listitem')).toHaveCount(2)
  await page.getByText('Your stats', { exact: true }).click()
  await expect(page.getByText('Days played', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Calendar' })).toBeVisible()
})
test('public results are readable without naming a player and the group editor stays available', async ({ page }) => {
  await mockSyncIdentity(page)
  await page.route('**/api/results**', (r) =>
    r.fulfill({ json: { rows: [{ name: 'Jon', game: 'bee', day: siteDay(), score: 90, stats: {} }] } }),
  )
  await page.goto('/leaderboards')
  await expect(page.getByRole('button', { name: 'Add your name' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Day results' })).toContainText('Jon')
  await page.getByRole('button', { name: 'Add your name' }).click()
  await page.getByLabel('Your name', { exact: true }).fill('Tester')
  await page.getByLabel(/Group code/).fill('Our-Group')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('device-player-name')).toHaveText('Tester')
  await expect(page.getByText('group our-group', { exact: true })).toBeVisible()
  await page.getByTestId('device-player-name').click()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Tester')
})
test('home shelf uses Set and Wordle and links the leaderboard beside Daily', async ({ page }) => {
  await mockSyncIdentity(page)
  await page.route('**/api/results**', (r) => r.fulfill({ json: { rows: [] } }))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Open Set', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Daily leaderboard', exact: true })).toHaveAttribute(
    'href',
    '/leaderboards',
  )
  await page.getByRole('button', { name: 'Daily', exact: true }).click()
  const shelf = page.getByRole('dialog', { name: 'Daily games' })
  await expect(shelf.getByRole('link', { name: 'Wordle', exact: true })).toHaveAttribute('href', '/games/wordle')
  await expect(shelf.getByRole('link', { name: 'Daily leaderboard', exact: true })).toHaveCount(0)
})
