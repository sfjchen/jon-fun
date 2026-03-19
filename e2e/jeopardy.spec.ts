import { test, expect } from '@playwright/test'

test.describe('Jeopardy', () => {
  test('menu shows Create New Game and upload options', async ({ page }) => {
    await page.goto('/games/jeopardy')
    await expect(page.getByRole('heading', { name: /Jeopardy with Friends/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create New Game' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload JSON to Edit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload JSON to Play' })).toBeVisible()
  })

  test('Create New Game opens editor', async ({ page }) => {
    await page.goto('/games/jeopardy')
    await page.getByRole('button', { name: 'Create New Game' }).click()
    await expect(page.getByText(/Category|Question|Answer|Back/i).first()).toBeVisible({ timeout: 3000 })
  })

  test('editor back returns to menu', async ({ page }) => {
    await page.goto('/games/jeopardy')
    await page.getByRole('button', { name: 'Create New Game' }).click()
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByRole('button', { name: 'Create New Game' })).toBeVisible()
  })
})
