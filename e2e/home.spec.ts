import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and shows game cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('sfjc.dev')).toBeVisible()
    await expect(page.getByText('TMR System')).toBeVisible()
    await expect(page.getByText('1 Sentence Everyday')).toBeVisible()
    await expect(page.getByRole('link', { name: /24/ })).toBeVisible()
  })

  test('navigates to TMR game', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /TMR System/i }).click()
    await expect(page).toHaveURL(/\/games\/tmr/)
  })

  test('Coming Soon modal opens and closes', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Coming Soon/i }).click()
    await expect(page.getByRole('button', { name: 'Close modal' })).toBeVisible()
    await page.getByRole('button', { name: 'Close modal' }).click()
    await expect(page.getByRole('button', { name: 'Close modal' })).not.toBeVisible()
  })
})
