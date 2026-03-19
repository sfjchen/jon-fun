import { test, expect } from '@playwright/test'

test.describe('TMR System', () => {
  test('menu shows Study and Sleep options', async ({ page }) => {
    await page.goto('/games/tmr')
    await expect(page.getByRole('button', { name: /Study Session/i }).nth(0)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sleep Reactivation/i }).nth(0)).toBeVisible()
    await expect(page.getByRole('button', { name: /Session History/i }).nth(0)).toBeVisible()
  })

  test('History view shows empty or sessions', async ({ page }) => {
    await page.goto('/games/tmr')
    await page.getByRole('button', { name: /Session History/i }).nth(0).click()
    await expect(page.getByRole('heading', { name: /Session History/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Study Sessions/i })).toBeVisible()
  })

  test('Study session flow starts', async ({ page }) => {
    await page.goto('/games/tmr')
    await page.getByRole('button', { name: /Study Session/i }).nth(0).click()
    await expect(page.getByRole('button', { name: /Back|←/i })).toBeVisible()
  })

  test('theme2 TMR loads', async ({ page }) => {
    await page.goto('/theme2/games/tmr')
    await expect(page).toHaveURL(/\/theme2\/games\/tmr/)
    await expect(page.getByRole('button', { name: /Study Session/i }).nth(0)).toBeVisible()
  })
})
