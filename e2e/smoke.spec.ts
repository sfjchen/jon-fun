/**
 * Smoke test: every game route renders its main content, and the home page links to the games.
 */
import { test, expect } from '@playwright/test'

import { mockDailyLearnApi } from './helpers/daily-learn-mock'

const ROUTES = [
  '/games/24',
  '/games/chwazi',
  '/games/tmr',
  '/games/pear-navigator',
  '/games/daily-log',
  '/leaderboards',
]

test.describe('Smoke', () => {
  for (const path of ROUTES) {
    test(`${path} renders`, async ({ page }) => {
      await mockDailyLearnApi(page)
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page.getByRole('main').first()).not.toBeEmpty({ timeout: 30_000 })
    })
  }

  test('home links to a game and the Home link returns', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByRole('link', { name: /Focus Chimes/i }).click()
    await expect(page).toHaveURL(/\/games\/tmr/)
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page).toHaveURL('/')
  })
})
