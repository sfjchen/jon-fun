import { test, expect } from '@playwright/test'

/**
 * Visual / layout checks — run against **deployed** sfjc.dev (what a human tester sees).
 *
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test e2e/uvimco-notes-visual.spec.ts --project=chromium
 *
 * Snapshots live in e2e/uvimco-notes-visual.spec.ts-snapshots/
 * Update baselines after intentional UI changes: `--update-snapshots`
 */
const isDeploy = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

test.describe('UVIMCO Notes visual', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/games/uvimco-notes')
    await page.waitForSelector('[data-testid="uvimco-meetings-sidebar"]', { timeout: 20_000 })
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 20_000 })
  })

  test('editor pane is tall enough to type (layout regression)', async ({ page }) => {
    const editor = page.getByTestId('uvimco-editor')
    const cm = page.locator('.uvimco-cm .cm-editor')
    await expect(editor).toBeVisible()
    await expect(cm).toBeVisible()

    const editorBox = await editor.boundingBox()
    const cmBox = await cm.boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(280)
    expect(cmBox?.height ?? 0).toBeGreaterThan(200)

    await editor.click()
    await page.keyboard.type('Visual E2E — editor height check.')
    await expect(page.locator('.uvimco-cm .cm-content')).toContainText('Visual E2E')
  })

  test('meetings sidebar lists active meeting on first paint', async ({ page }) => {
    await expect(page.getByTestId('uvimco-meetings-sidebar')).toContainText(/Meeting|Untitled/)
    await expect(page.locator('[data-testid^="uvimco-meeting-item-"]')).toHaveCount(1, { timeout: 5000 })
  })

  test('desktop layout screenshot', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to snapshot deployed sfjc.dev')
    await expect(page).toHaveScreenshot('uvimco-notes-desktop.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.08,
    })
  })

  test('mobile layout screenshot', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to snapshot deployed sfjc.dev')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/games/uvimco-notes')
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 20_000 })
    const editorBox = await page.getByTestId('uvimco-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(180)
    await expect(page).toHaveScreenshot('uvimco-notes-mobile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.1,
    })
  })
})
