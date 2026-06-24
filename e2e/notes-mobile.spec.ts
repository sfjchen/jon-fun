import { test, expect } from '@playwright/test'
import {
  dropCsvOnNotesEditor,
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
  waitForNotesTrigger,
  typeInNotesEditor,
} from './helpers/notes-mock'

/** True mobile viewport — do not inherit desktop 1280px from other describe blocks. */
const MOBILE = { width: 390, height: 844 }

test.describe('Notes mobile', () => {
  test.use({ viewport: MOBILE, isMobile: true, hasTouch: true, acceptDownloads: true })

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockNotesApi(page)
    await page.goto('/games/notes', { waitUntil: 'load' })
    await page.evaluate((key) => {
      localStorage.removeItem(key)
      localStorage.removeItem('notes_active_session_id')
      localStorage.removeItem('notes_user_id')
      localStorage.removeItem('notes_ui_prefs')
      localStorage.removeItem('notes_glossary')
      localStorage.removeItem('notes_sources')
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('editor fills viewport height; panel hidden by default', async ({ page }) => {
    const editorBox = await page.getByTestId('notes-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(200)
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
    await expect(page.getByTestId('notes-toggle-panel')).toBeVisible()
  })

  test('panel opens as overlay with backdrop and closes via backdrop or status bar', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-panel-backdrop')).toBeVisible()
    await page.getByTestId('notes-panel-backdrop').click({ position: { x: 8, y: 200 } })
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()

    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
  })

  test('typing, bold toolbar, and session switch work on touch viewport', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('mobile body text')
    await expect(editor).toContainText('mobile body text')

    await page.keyboard.press('ControlOrMeta+a')
    await page.getByTestId('notes-editor-toolbar').getByRole('button', { name: 'B' }).click()
    await expect(editor.locator('strong')).toContainText('mobile body text')

    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-new-meeting').click()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)
    await page.getByTestId('notes-panel-backdrop').click({ position: { x: 8, y: 200 } })
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
  })

  test('search button opens global search and jumps to hit', async ({ page }) => {
    await typeInNotesEditor(page, 'mobile MOIC token')
    await page.getByTestId('notes-search-btn').click()
    await expect(page.getByTestId('notes-global-search')).toBeVisible()
    await page.getByTestId('notes-search-input').fill('MOIC')
    await expect(page.getByTestId('notes-search-hit').first()).toBeVisible({ timeout: 8000 })
    await page.getByTestId('notes-search-hit').first().click()
    await expect(notesEditor(page)).toContainText('mobile MOIC token')
    await expect(page.getByTestId('notes-global-search')).toBeHidden()
  })

  test('line? trigger opens panel and shows AI response', async ({ page }) => {
    await typeInNotesEditor(page, 'fund DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })
  })

  test('tag chips visible and toggle on mobile', async ({ page }) => {
    await expect(page.getByTestId('notes-tag-chip-IC')).toBeVisible()
    await page.getByTestId('notes-tag-chip-IC').click()
    await expect(page.getByTestId('notes-tag-chip-IC')).toHaveClass(/bg-\[var\(--uv-accent\)\]/)
  })

  test('export markdown from status bar menu', async ({ page }) => {
    await typeInNotesEditor(page, 'export on mobile')
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('notes-export-toggle').click()
    await page.getByTestId('notes-export-md').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.md$/i)
  })

  test('sync panel accepts password on mobile', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-sync-password-input').fill('mobile-sync-key')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByText('Synced', { exact: false })).toBeVisible({ timeout: 10_000 })
  })

  test('dictionary add term on mobile', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-glossary-toggle').click()
    await page.getByTestId('notes-dictionary-add').click()
    await page.getByTestId('notes-dictionary-term-input').fill('TVPI')
    await page.getByTestId('notes-dictionary-def-input').fill('Total value to paid-in')
    await page.getByTestId('notes-dictionary-save').click()
    await expect(page.getByTestId('notes-glossary-panel')).toContainText('TVPI')
  })

  test('inline table insert via toolbar on mobile', async ({ page }) => {
    await page.getByTestId('notes-table-insert-btn').click()
    await expect(page.getByTestId('notes-table-insert-popover')).toBeVisible()
    await page.getByTestId('notes-table-insert-confirm').click()
    await expect(notesEditor(page).locator('table')).toBeVisible({ timeout: 5000 })
  })

  test('CSV attachment via e2e hook on mobile', async ({ page }) => {
    await page.goto('/games/notes?notesE2e=1', { waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
    await dropCsvOnNotesEditor(page, 'Ticker,Price\nAAPL,190')
    await expect(page.getByTestId('notes-attachment').first()).toBeVisible({ timeout: 8000 })
  })

  test('New button in status bar creates note on mobile', async ({ page }) => {
    await page.getByTestId('notes-header-new').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)
  })
})
