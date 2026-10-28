import { test, expect } from '@playwright/test'
import { SFJC_ADMIN_DEVICES } from '../src/data/sfjc-admin-devices'

test.describe('Home page', () => {
  test('loads and shows game cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByText('sfjc.dev').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Focus Chimes')).toBeVisible()
    await expect(page.getByText('1 Sentence Everyday')).toBeVisible()
    await expect(page.getByRole('link', { name: /24/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Mental Obstacle Course/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Quip Clash/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Fib It/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Enough About You/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Open Connections/i })).toBeVisible()
  })

  test('navigates to TMR game', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByRole('link', { name: /Focus Chimes/i }).click()
    await expect(page).toHaveURL(/\/games\/tmr/)
  })

  test('hides Coming Soon from strangers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByRole('link', { name: /Focus Chimes/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Coming Soon/i })).toHaveCount(0)
  })

  test('Coming Soon modal opens and closes on owner device', async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem('notes_user_id', id), SFJC_ADMIN_DEVICES[0].id)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const comingSoon = page.getByRole('button', { name: /Coming Soon/i })
    await expect(comingSoon).toBeEnabled({ timeout: 25_000 })
    await comingSoon.click()
    await expect(page.getByRole('button', { name: 'Close modal' })).toBeVisible()
    await page.getByRole('button', { name: /Edit this message/i }).click()
    await expect(page.getByLabel(/^Password$/i)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Close modal' }).click()
    await expect(page.getByRole('button', { name: 'Close modal' })).not.toBeVisible()
  })
})
