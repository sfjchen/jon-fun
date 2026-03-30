import { test, expect } from '@playwright/test'

const GAME_ROUTES = [
  { path: '/games/tmr', name: 'TMR System' },
  { path: '/games/daily-log', name: '1 Sentence Everyday' },
  { path: '/games/24', name: '24' },
  { path: '/games/jeopardy', name: 'Jeopardy' },
  { path: '/games/poker', name: "Texas Hold'em" },
  { path: '/games/chwazi', name: 'Chwazi' },
  { path: '/leaderboards', name: 'Leaderboards' },
] as const

test.describe('Navigation', () => {
  for (const { path, name } of GAME_ROUTES) {
    test(`navigates to ${name} from home`, async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: new RegExp(name, 'i') }).nth(0).click()
      await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    })
  }

  test('theme switch preserves path', async ({ page }) => {
    await page.goto('/games/tmr')
    await expect(page).toHaveURL(/\/games\/tmr/)
    await page.getByRole('link', { name: 'Theme 2' }).click()
    await expect(page).toHaveURL(/\/theme2\/games\/tmr/)
    await page.getByRole('link', { name: 'Main' }).click()
    await expect(page).toHaveURL(/\/games\/tmr/)
  })

  test('← Home returns to root', async ({ page }) => {
    await page.goto('/games/24')
    await page.getByRole('link', { name: '← Home' }).click()
    await expect(page).toHaveURL('/')
  })

  test('theme2 home shows same game cards', async ({ page }) => {
    await page.goto('/theme2')
    await expect(page.getByText('sfjc.dev')).toBeVisible()
    await expect(page.getByText('TMR System')).toBeVisible()
  })

  test('Pear Navigator still reachable by URL (archived from Theme 1 home)', async ({ page }) => {
    await page.goto('/games/pear-navigator')
    await expect(page).toHaveURL(/\/games\/pear-navigator/)
  })
})
