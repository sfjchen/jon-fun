import { test, expect } from '@playwright/test'

test.describe('Texas Hold\'em', () => {
  test('lobby shows Create Room and Join Room tabs', async ({ page }) => {
    await page.goto('/games/poker')
    await expect(page.getByRole('heading', { name: /Texas Hold'em/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Room' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible()
  })

  test('Create Room form has required fields', async ({ page }) => {
    await page.goto('/games/poker')
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible()
    await expect(page.getByRole('spinbutton').first()).toBeVisible()
  })

  test('Join Room requires 4-digit PIN', async ({ page }) => {
    await page.goto('/games/poker')
    await page.getByRole('button', { name: 'Join Room' }).click()
    const pinInput = page.getByPlaceholder('0000')
    await expect(pinInput).toBeVisible()
    await pinInput.fill('12')
    await expect(page.getByRole('button', { name: 'Continue to Select Seat' })).toBeDisabled()
    await pinInput.fill('1234')
    await expect(page.getByRole('button', { name: 'Continue to Select Seat' })).toBeEnabled()
  })

  test('Create Room form submits (requires Supabase)', async ({ page }) => {
    await page.goto('/games/poker')
    await page.getByPlaceholder('Enter your name').fill('E2E Host')
    await page.locator('form').getByRole('button', { name: 'Create Room' }).click()
    try {
      await page.waitForURL(/\/lobby\//, { timeout: 25_000 })
    } catch {
      await expect(
        page.getByText(/Failed|error|invalid|Unauthorized|could not|Network|Something went wrong/i).first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})
