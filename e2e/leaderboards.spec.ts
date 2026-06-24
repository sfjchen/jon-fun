import { test, expect } from '@playwright/test'

test.describe('Leaderboards', () => {
  test('shows parked state and home link', async ({ page }) => {
    await page.goto('/leaderboards')
    await expect(page.getByRole('heading', { name: 'Leaderboards' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Parked for now' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible()
  })

  test('Home link navigates to /', async ({ page }) => {
    await page.goto('/leaderboards')
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page).toHaveURL(/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/)
  })
})
