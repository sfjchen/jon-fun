import { test, expect } from '@playwright/test'
import {
  ensureNotesVaultSectionOpen,
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
      localStorage.removeItem('notes_ui_prefs')
      localStorage.removeItem('notes_glossary')
      localStorage.removeItem('notes_sources')
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('panel opens as overlay with backdrop and closes via backdrop or status bar', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-panel-backdrop')).toBeVisible()
    await page.getByTestId('notes-panel-backdrop').click({ position: { x: 8, y: 200 } })
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()

    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
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
    await ensureNotesVaultSectionOpen(page)
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

})
