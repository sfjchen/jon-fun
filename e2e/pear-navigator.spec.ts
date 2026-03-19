import { test, expect } from '@playwright/test'

test.describe('Pear Navigator', () => {
  test('shows task selection', async ({ page }) => {
    await page.goto('/games/pear-navigator')
    await expect(page.getByText(/Your first painting|Design a business card|Create a mindmap/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('selecting task starts guide', async ({ page }) => {
    await page.goto('/games/pear-navigator')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Your first painting/i }).click()
    await expect(page.getByText(/Step|Next|guide|tap|Canvas/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('results page loads', async ({ page }) => {
    await page.goto('/games/pear-navigator/results')
    await expect(page).toHaveURL(/\/games\/pear-navigator\/results/)
    await expect(page.locator('body')).toContainText(/variant|completion|A\/B|statistical|Results/i, { timeout: 5000 })
  })

  test('theme2 pear-navigator loads', async ({ page }) => {
    await page.goto('/theme2/games/pear-navigator')
    await expect(page).toHaveURL(/\/theme2\/games\/pear-navigator/)
  })
})
