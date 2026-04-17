import { test, expect } from '@playwright/test'

test.describe('1 Sentence Everyday', () => {
  test('shows today entry and tabs', async ({ page }) => {
    await page.goto('/games/daily-log')
    await expect(page.getByRole('heading', { name: '1 Sentence Everyday' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'analytics' })).toBeVisible()
    await expect(page.getByPlaceholder(/One sentence/i)).toBeVisible()
  })

  test('can type in today textarea', async ({ page }) => {
    await page.goto('/games/daily-log')
    const textarea = page.getByPlaceholder(/One sentence/i)
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('E2E test entry')
    await expect(textarea).toHaveValue('E2E test entry')
  })
})
