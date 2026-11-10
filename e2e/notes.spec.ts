import { test, expect } from '@playwright/test'

import {
  ensureNotesVaultSectionOpen,
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
  waitForNotesTrigger,
  typeInNotesEditor,
  dragNoteTitleToSplitPane,
} from './helpers/notes-mock'

test.describe('Notes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockNotesApi(page, { owner: true })
    await page.goto('/games/notes', { waitUntil: 'load' })
    await page.evaluate((key) => {
      try {
        localStorage.removeItem(key)
        localStorage.removeItem('notes_active_session_id')
        localStorage.removeItem('notes_ui_prefs')
        localStorage.removeItem('notes_glossary')
        localStorage.removeItem('notes_sources')
        localStorage.removeItem('notes_folders')
      } catch {
        /* ignore */
      }
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
    await ensureNotesVaultSectionOpen(page)
  })

  test('loads full-width editor; panel open by default on desktop', async ({ page }) => {
    await expect(page.getByTestId('notes-meeting-title')).toBeVisible({ timeout: 10000 })
    await expect(notesEditor(page)).toBeVisible({ timeout: 15000 })
    const editorBox = await page.getByTestId('notes-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(280)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-meeting-title')).toHaveAttribute('placeholder', 'Untitled')
  })

  test('creates a second note and switches between them', async ({ page }) => {

    const title = page.getByTestId('notes-meeting-title')
    await title.fill('IC standup')
    await expect(title).toHaveValue('IC standup')

    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('boss flagged DPI gap?')
    await waitForNotesTrigger(page)

    await page.getByTestId('notes-new-meeting').click()
    await expect(title).not.toHaveValue('IC standup')

    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)
    await meetings.nth(1).click()
    await expect(title).toHaveValue('IC standup')
    await expect(editor).toContainText('DPI gap?')
  })

  test('line? trigger opens panel and shows mock AI response', async ({ page }) => {
    const editor = notesEditor(page)
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('review DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
    await expect(page.getByTestId('notes-side-panel')).not.toContainText(/Core meaning/i)
  })

  test('bold round-trip persists formatted text across session switch', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('important term')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+b')
    await expect(editor.locator('strong')).toContainText('important term')

    await page.getByTestId('notes-new-meeting').click()
    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)
    await meetings.nth(1).click()
    await expect(editor.locator('strong')).toContainText('important term', { timeout: 5000 })
  })

  test('save then quick switch preserves typed content', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('persist-after-save line one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('line two with content')

    await page.getByTestId('notes-new-meeting').click()
    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)

    await page.keyboard.press('Control+s')
    await meetings.nth(1).click()

    await expect(editor).toContainText('persist-after-save line one', { timeout: 5000 })
    await expect(editor).toContainText('line two with content')
  })

  test('todo line appears in rollup panel', async ({ page }) => {
    await typeInNotesEditor(page, '> follow up IC memo')
    await expect(page.getByTestId('notes-statusbar')).toContainText('1 todos', { timeout: 8000 })
    await expect(page.getByTestId('notes-rollup-panel')).toContainText('follow up IC memo', { timeout: 8000 })
  })

  test('tag chips toggle on note and persist in localStorage', async ({ page }) => {
    await expect(page.getByTestId('notes-tag-chip-meeting')).toBeVisible()
    await page.getByTestId('notes-tag-chip-meeting').click()
    await expect(page.getByTestId('notes-tag-chip-meeting')).toHaveClass(/bg-\[var\(--uv-accent\)\]/)

    await page.getByTestId('notes-tag-input').fill('custom-tag')
    await page.getByTestId('notes-tag-input').press('Enter')
    await expect(page.getByTestId('notes-tag-chip-custom-tag')).toBeVisible()

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions') ?? '[]'
      const sessions = JSON.parse(raw) as { tags: string[] }[]
      return sessions[0]?.tags ?? []
    })
    expect(stored).toContain('meeting')
    expect(stored).toContain('custom-tag')
  })

  test('Ctrl+S saves and shows Saved in status bar', async ({ page }) => {
    await typeInNotesEditor(page, 'autosave check')
    await page.keyboard.press('Control+s')
    await expect(page.getByTestId('notes-sync-label')).toContainText(/Saved|Synced/, { timeout: 10_000 })
  })

  test('paste Google Docs HTML list as dash lines', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<meta charset="utf-8"><ul><li>first bullet</li><li><span style="font-weight:700">bold</span> second</li></ul>',
      )
      dt.setData('text/plain', 'first bullet\nbold second')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- first bullet')
    await expect(editor).toContainText('- bold second')
    await expect(editor.locator('strong')).toContainText('bold')
  })

  test('Enter continues dash list on next line', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('- one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('two')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- two')
  })

  test('Tab indents line; Shift+Tab outdents', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('indented')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Tab')
    await expect(editor).toHaveText('  indented')
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Shift+Tab')
    await expect(editor).toHaveText('indented')
  })

  test.describe('split view', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/games/notes?notesE2e=1', { waitUntil: 'domcontentloaded' })
      await waitForNotesEditor(page)
      await ensureNotesVaultSectionOpen(page)
    })

    test('drag note by title to right opens split; both panes edit independently; close returns single', async ({
      page,
    }) => {
      await page.getByTestId('notes-meeting-title').fill('Note Alpha')
      await typeInNotesEditor(page, 'alpha body')

      await page.getByTestId('notes-new-meeting').click()
      await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)

      await page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: 'Note Alpha' }).click()
      await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Alpha')

      const inactiveItem = page.locator('[data-testid^="notes-meeting-item-"][data-active="false"]').first()
      const secondId = (await inactiveItem.getAttribute('data-testid'))!.replace('notes-meeting-item-', '')
      await dragNoteTitleToSplitPane(page, secondId, 'right')

      await expect(page.getByTestId('notes-split-root')).toHaveAttribute('data-split', 'true', { timeout: 5000 })
      const leftEd = notesEditor(page, 'left')
      const rightEd = notesEditor(page, 'right')
      await expect(leftEd).toContainText('alpha body')
      await expect(rightEd).toBeVisible()

      await rightEd.click()
      await page.keyboard.type('beta body')
      await expect(rightEd).toContainText('beta body')

      await leftEd.click()
      await page.keyboard.press('End')
      await page.keyboard.type(' more alpha')
      await expect(leftEd).toContainText('alpha body more alpha')
      await expect(rightEd).toContainText('beta body')

      await page.getByTestId('notes-meeting-title-right').fill('Note Beta')
      await expect(page.getByTestId('notes-meeting-title-right')).toHaveValue('Note Beta')

      await page.getByTestId('notes-split-close-right').click()
      await expect(page.getByTestId('notes-split-root')).toHaveAttribute('data-split', 'false')
      await expect(page.getByTestId('notes-editor-right')).toHaveCount(0)
    })

  })
})
