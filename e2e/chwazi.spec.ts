import { test, expect } from '@playwright/test'

test.describe('Chwazi Finger Chooser', () => {
  test('shows touchscreen message on desktop or game on touch device', async ({ page }) => {
    await page.goto('/games/chwazi')
    // On desktop: "This game is only available on touchscreen devices"
    // On touch/mobile: shows the game
    const touchMessage = page.getByText(/touchscreen|touch-enabled/i)
    const gameOrMessage = page.getByText(/Chwazi|Place fingers|touchscreen/i)
    await expect(gameOrMessage.first()).toBeVisible({ timeout: 5000 })
  })

  test('theme2 chwazi loads', async ({ page }) => {
    await page.goto('/theme2/games/chwazi')
    await expect(page).toHaveURL(/\/theme2\/games\/chwazi/)
  })
})
