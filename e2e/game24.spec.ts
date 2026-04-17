import { test, expect } from '@playwright/test'

test.describe('Game 24', () => {
  test('loads and shows game area', async ({ page }) => {
    await page.goto('/games/24')
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('1234')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
  })

  test('practice mode shows number cards', async ({ page }) => {
    await page.goto('/games/24')
    await page.waitForLoadState('networkidle')
    const cardNumbers = page.locator('.card-number')
    await expect(cardNumbers.first()).toBeVisible({ timeout: 5000 })
    await expect(cardNumbers).toHaveCount(4)
  })

  test('practice mode: select card and operator', async ({ page }) => {
    await page.goto('/games/24')
    await page.waitForLoadState('networkidle')
    const firstCard = page.locator('.practice-card').first()
    await firstCard.click()
    await expect(page.getByRole('button', { name: '+ operator' })).toBeVisible({ timeout: 2000 })
  })
})
