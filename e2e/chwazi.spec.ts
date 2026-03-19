import { test, expect } from '@playwright/test'

test.describe('Chwazi Finger Chooser', () => {
  test('shows touchscreen message on desktop or game on touch device', async ({ page }) => {
    await page.goto('/games/chwazi')
    // On desktop: "This game is only available on touchscreen devices"
    // On touch/mobile: shows the game with "Place your fingers" or "Place and hold"
    await expect(
      page.getByText(/Chwazi|Place your fingers|Place and hold|touchscreen devices/i).nth(0)
    ).toBeVisible({ timeout: 8000 })
  })

  test('theme2 chwazi loads', async ({ page }) => {
    await page.goto('/theme2/games/chwazi')
    await expect(page).toHaveURL(/\/theme2\/games\/chwazi/)
  })
})
