import { test, expect } from '@playwright/test'

test.describe('Leaderboards', () => {
  test('shows Coming Soon and Play 24 link', async ({ page }) => {
    await page.goto('/leaderboards')
    await expect(page.getByRole('heading', { name: 'Leaderboards' })).toBeVisible()
    await expect(page.getByText('Coming Soon!')).toBeVisible()
    await expect(page.getByRole('link', { name: /Play 24 Game/i })).toBeVisible()
  })

  test('Play 24 Game link navigates to game24', async ({ page }) => {
    await page.goto('/leaderboards')
    await page.getByRole('link', { name: /Play 24 Game/i }).click()
    await expect(page).toHaveURL(/\/games\/24/)
  })

  test('theme2 leaderboards loads', async ({ page }) => {
    await page.goto('/theme2/leaderboards')
    await expect(page).toHaveURL(/\/theme2\/leaderboards/)
    await expect(page.getByText('Coming Soon!')).toBeVisible()
  })
})
