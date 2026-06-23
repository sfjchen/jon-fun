import { test, expect } from '@playwright/test'
import { notesEditor, waitForNotesEditor } from './helpers/notes-mock'

/**
 * Visual / layout checks on **deployed** sfjc.dev.
 *
 *   npm run test:e2e:notes-visual
 */
const isDeploy = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

test.describe('Notes visual', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/games/notes')
    await page.waitForSelector('[data-testid="notes-editor"]', { timeout: 20_000 })
    await waitForNotesEditor(page)
  })

  test('editor pane is tall enough to type (layout regression)', async ({ page }) => {
    const editor = page.getByTestId('notes-editor')
    const tiptap = page.locator('[data-testid="notes-tiptap-editor"]')
    const editorBox = await editor.boundingBox()
    const tiptapBox = await tiptap.boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(280)
    expect(tiptapBox?.height ?? 0).toBeGreaterThan(200)

    await notesEditor(page).click()
    await page.keyboard.type('Visual E2E — editor height check.')
    await expect(notesEditor(page)).toContainText('Visual E2E')
  })

  test('full-width editor when panel closed', async ({ page }) => {
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
    const editor = page.getByTestId('notes-editor')
    const box = await editor.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(900)
  })

  test('desktop layout screenshot', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to snapshot deployed sfjc.dev')
    await expect(page).toHaveScreenshot('notes-desktop.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.08,
    })
  })

  test('panel open screenshot', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to snapshot deployed sfjc.dev')
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page).toHaveScreenshot('notes-panel-open.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.08,
    })
  })

  test('mobile layout screenshot', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to snapshot deployed sfjc.dev')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editorBox = await page.getByTestId('notes-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(180)
    await expect(page).toHaveScreenshot('notes-mobile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.1,
    })
  })
})
