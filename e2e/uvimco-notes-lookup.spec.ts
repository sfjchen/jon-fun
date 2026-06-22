import { test, expect } from '@playwright/test'

/**
 * Real AI lookup on deployed sfjc.dev (no lookup API mock).
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test e2e/uvimco-notes-lookup.spec.ts
 */
const isDeploy = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

async function waitForLookupStream(page: import('@playwright/test').Page) {
  await page.waitForResponse(
    (res) => res.url().includes('/api/notes/lookup') && res.status() === 200,
    { timeout: 45_000 },
  )
}

test.describe('Notes AI lookup (deploy)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test.slow()

  test.beforeEach(async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1')
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
      localStorage.setItem('notes_user_id', `e2e-lookup-${Date.now()}`)
      localStorage.removeItem('notes_ui_prefs')
    })
    await page.goto('/games/notes')
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 20_000 })
  })

  test('line ending with ? opens panel and streams answer', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    const stream = waitForLookupStream(page)
    await page.keyboard.type('fund DPI ratio?')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 15_000 })
    await stream
    await expect(page.getByTestId('notes-side-panel')).toContainText(/DPI|distribution|paid-in|capital/i, {
      timeout: 45_000,
    })
  })

  test('section ending with ?? opens panel and streams answer', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    const stream = waitForLookupStream(page)
    await page.keyboard.type('LP stakes in fund')
    await page.keyboard.press('Enter')
    await page.keyboard.type('GP fee structure??')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 15_000 })
    await stream
    await expect(page.getByTestId('notes-side-panel')).toContainText(/LP|GP|fee|general partner/i, {
      timeout: 45_000,
    })
  })
})
