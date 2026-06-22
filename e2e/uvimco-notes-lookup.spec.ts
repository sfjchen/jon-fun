import { test, expect } from '@playwright/test'

/**
 * Real AI lookup on deployed sfjc.dev (no lookup API mock).
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test e2e/uvimco-notes-lookup.spec.ts
 */
const isDeploy = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

async function waitForLookupStream(page: import('@playwright/test').Page) {
  await page.waitForResponse(
    (res) => res.url().includes('/api/uvimco-notes/lookup') && res.status() === 200,
    { timeout: 45_000 },
  )
}

test.describe('Notes AI lookup (deploy)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test.slow()

  test.beforeEach(async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1')
    await page.addInitScript(() => {
      localStorage.removeItem('uvimco_notes_sessions')
      localStorage.removeItem('uvimco_notes_active_session_id')
      localStorage.setItem('uvimco_notes_user_id', `e2e-lookup-${Date.now()}`)
      localStorage.removeItem('notes_ui_prefs')
    })
    await page.goto('/games/notes')
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 20_000 })
  })

  test('?term + space opens panel and streams answer', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    const stream = waitForLookupStream(page)
    await page.keyboard.type('fund ?DPI ')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('notes-ai-toggle')).toBeVisible()
    await stream
    const panel = page.getByTestId('notes-side-panel')
    await expect(panel).toContainText(/DPI|distribution|paid-in|capital/i, { timeout: 45_000 })
  })

  test('?term + Enter opens panel and streams answer', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    const stream = waitForLookupStream(page)
    await page.keyboard.type('review ?MOIC')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 15_000 })
    await stream
    await expect(page.getByTestId('notes-side-panel')).toContainText(/MOIC|multiple|capital/i, {
      timeout: 45_000,
    })
  })

  test('hyphenated ?term + space triggers lookup', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    const stream = waitForLookupStream(page)
    await page.keyboard.type('?LP-GP ')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 15_000 })
    await stream
    await expect(page.getByTestId('notes-side-panel')).toContainText(/LP|GP|general partner|limited partner/i, {
      timeout: 45_000,
    })
  })
})
