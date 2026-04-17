import { test, expect } from '@playwright/test'

test.describe('Pear Navigator', () => {
  test.describe.configure({ timeout: 120_000 })

  test('shows task selection', async ({ page }) => {
    await page.goto('/games/pear-navigator', { waitUntil: 'load', timeout: 60_000 })
    await expect(page.getByText(/Your first painting|Design a business card|Create a mindmap/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('selecting task starts guide', async ({ page }) => {
    await page.goto('/games/pear-navigator', { waitUntil: 'load', timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Your first painting/i }).click()
    await expect(page.getByText(/Step|Next|guide|tap|Canvas/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('results page loads', async ({ page }) => {
    await page.goto('/games/pear-navigator/results', { waitUntil: 'load', timeout: 60_000 })
    await expect(page).toHaveURL(/\/games\/pear-navigator\/results/)
    await expect(page.locator('body')).toContainText(/variant|completion|A\/B|statistical|Results/i, { timeout: 20_000 })
  })
})
