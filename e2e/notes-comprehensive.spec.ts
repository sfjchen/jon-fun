import { test, expect } from '@playwright/test'
import {
  mockNotesApi,
  notesEditor,
  waitForNotesEditor,
  waitForNotesTrigger,
  typeInNotesEditor,
} from './helpers/notes-mock'

/** Broad functional coverage: shortcuts, panel UX, dictionary, delete flows. */
test.describe('Notes comprehensive', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockNotesApi(page)
    await page.goto('/games/notes', { waitUntil: 'load' })
    await page.evaluate(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
      localStorage.removeItem('notes_user_id')
      localStorage.removeItem('notes_ui_prefs')
      localStorage.removeItem('notes_glossary')
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('Ctrl+\\ toggles side panel', async ({ page }) => {
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
    await page.keyboard.press('Control+\\')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await page.keyboard.press('Control+\\')
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
  })

  test('Ctrl+Shift+H toggles shorthand hints', async ({ page }) => {
    await expect(page.getByTestId('notes-shorthand-toggle')).toContainText('Hints')
    await page.keyboard.press('Control+Shift+H')
    await expect(page.getByTestId('notes-shorthand-toggle')).toContainText('Hide hints')
    await page.keyboard.press('Control+Shift+H')
    await expect(page.getByTestId('notes-shorthand-toggle')).toContainText('Hints')
  })

  test('Escape closes global search', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    await expect(page.getByTestId('notes-global-search')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('notes-global-search')).toBeHidden()
  })

  test('Ctrl+K summarize opens AI panel response', async ({ page }) => {
    await typeInNotesEditor(page, 'Fund metrics summary line')
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })
  })

  test('status bar hides panel', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
  })

  test('dictionary add term persists in localStorage', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-glossary-toggle').click()
    await page.getByTestId('notes-dictionary-add').click()
    await page.getByTestId('notes-dictionary-term-input').fill('DPI')
    await page.getByTestId('notes-dictionary-def-input').fill('Distributions to paid-in capital')
    await page.getByTestId('notes-dictionary-save').click()
    await expect(page.getByTestId('notes-glossary-panel')).toContainText('DPI')

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_glossary') ?? '[]'
      return JSON.parse(raw) as { term: string }[]
    })
    expect(stored.some((e) => e.term === 'DPI')).toBe(true)
  })

  test('delete note from top bar removes session', async ({ page }) => {
    await page.getByTestId('notes-meeting-title').fill('To delete')
    await typeInNotesEditor(page, 'body')
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-new-meeting').click()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)

    await page.getByTestId('notes-delete-note').click()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
  })

  test('underline via Ctrl+U', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('underlined')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+u')
    await expect(editor.locator('u')).toContainText('underlined')
  })

  test('search hit jumps to note content', async ({ page }) => {
    await typeInNotesEditor(page, 'unique MOIC search token')
    await page.keyboard.press('Control+Shift+F')
    await page.getByTestId('notes-search-input').fill('MOIC')
    await expect(page.getByTestId('notes-search-hit').first()).toBeVisible({ timeout: 8000 })
    await page.getByTestId('notes-search-hit').first().click()
    await expect(notesEditor(page)).toContainText('unique MOIC search token')
    await expect(page.getByTestId('notes-global-search')).toBeHidden()
  })

  test('mobile viewport: panel toggle and editor usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('mobile note text')
    await expect(editor).toContainText('mobile note text')
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-panel-backdrop')).toBeVisible()
    await page.getByTestId('notes-panel-close').click()
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
  })
})
