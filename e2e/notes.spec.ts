import { test, expect } from '@playwright/test'

import {
  ensureNotesPanelOpen,
  ensureNotesVaultSectionOpen,
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
  waitForLookupComplete,
  waitForNotesTrigger,
  typeInNotesEditor,
} from './helpers/notes-mock'

test.describe('Notes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockNotesApi(page)
    await page.goto('/games/notes', { waitUntil: 'load' })
    await page.evaluate((key) => {
      try {
        localStorage.removeItem(key)
        localStorage.removeItem('notes_active_session_id')
        localStorage.removeItem('notes_user_id')
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

  test('panel sections default: AI + todos expanded, vault collapsed', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('notes_ui_prefs'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)

    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-meetings-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('notes-rollup-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('notes-ai-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('notes-glossary-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('notes-sources-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('notes-history-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('notes-sync-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('notes-vault-panel')).toBeHidden()
    await expect(page.getByTestId('notes-sync-panel')).toBeHidden()
  })

  test('creates nested subfolder and moves note via drag and drop', async ({ page }) => {
    await page.getByTestId('notes-new-folder').click()
    await page.getByTestId('notes-new-folder-input').fill('Work')
    await page.getByTestId('notes-new-folder-input').press('Enter')

    const workToggle = page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'Work' })
    await expect(workToggle).toBeVisible({ timeout: 5000 })
    await workToggle.click()

    await page.locator('button[title="New subfolder"]').click()
    await page.getByTestId('notes-new-folder-input').fill('IC')
    await page.getByTestId('notes-new-folder-input').press('Enter')
    await expect(page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'IC' })).toBeVisible()

    const noteRow = page.locator('[data-testid^="notes-note-row-"]').first()
    const icBody = page.locator('[data-testid^="notes-folder-body-"]').last()
    await noteRow.dragTo(icBody)

    await expect(page.getByTestId('notes-folder-toggle-__inbox__')).toContainText('(0)')
    await expect(page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'IC' })).toContainText('(1)')
  })

  test('drags folder into another folder to nest it', async ({ page }) => {
    await page.getByTestId('notes-new-folder').click()
    await page.getByTestId('notes-new-folder-input').fill('Work')
    await page.getByTestId('notes-new-folder-input').press('Enter')
    await page.getByTestId('notes-new-folder').click()
    await page.getByTestId('notes-new-folder-input').fill('Archive')
    await page.getByTestId('notes-new-folder-input').press('Enter')

    const archiveRow = page.locator('[data-testid^="notes-folder-drop-"]').filter({ hasText: 'Archive' })
    const archiveDrag = archiveRow.locator('[data-testid^="notes-folder-drag-"]')
    const workDrop = page.locator('[data-testid^="notes-folder-drop-"]').filter({ hasText: 'Work' })
    await archiveDrag.dragTo(workDrop)

    await expect(page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'Archive' })).toBeVisible({
      timeout: 5000,
    })
  })

  test('creates folder and nests note', async ({ page }) => {
    await page.getByTestId('notes-new-folder').click()
    await page.getByTestId('notes-new-folder-input').fill('Work')
    await page.getByTestId('notes-new-folder-input').press('Enter')
    const workToggle = page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'Work' })
    await expect(workToggle).toBeVisible({ timeout: 5000 })
    await workToggle.click()
    await page.locator('button[title="New note in folder"]').click()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)
  })

  test('builtin domain packs seed in Sources panel', async ({ page }) => {
    await page.getByTestId('notes-sources-toggle').click()
    await expect(page.getByTestId('notes-sources-panel')).toBeVisible()
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] UVIMCO endowment')
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] CFA Level I')
  })

  test('source checkboxes are per-note and attach file works', async ({ page }) => {
    await page.getByTestId('notes-sources-toggle').click()

    const panel = page.getByTestId('notes-sources-panel')
    await expect(panel).toBeVisible()

    const title = page.getByTestId('notes-meeting-title')
    await title.fill('Source note A')

    const packCheckbox = panel.locator('[data-testid^="notes-source-check-builtin-pack-"]').first()
    await expect(packCheckbox).toBeChecked()

    await packCheckbox.uncheck()
    await expect(packCheckbox).not.toBeChecked()

    await page.getByTestId('notes-new-meeting').click()
    const packCheckboxNote2 = panel.locator('[data-testid^="notes-source-check-builtin-pack-"]').first()
    await expect(packCheckboxNote2).toBeChecked()

    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)
    await meetings.filter({ hasText: 'Source note A' }).click()
    await expect(packCheckbox).not.toBeChecked()

    await page.getByTestId('notes-sources-attach').click()
    await page.getByTestId('notes-sources-file-input').setInputFiles({
      name: 'memo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Custom IPS excerpt for E2E.'),
    })
    await expect(panel).toContainText('memo')
    await packCheckbox.check()
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

  test('renames note inline from sidebar on double-click', async ({ page }) => {
    const title = page.getByTestId('notes-meeting-title')
    await title.fill('Original title')

    await page.getByTestId('notes-new-meeting').click()
    await title.fill('Other note')

    const firstNote = page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: 'Original title' })
    await firstNote.dblclick()

    const renameInput = page.locator('[data-testid^="notes-sidebar-title-input-"]')
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill('Renamed in sidebar')
    await renameInput.press('Enter')

    const renamedNote = page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: 'Renamed in sidebar' })
    await expect(renamedNote).toBeVisible()
    await renamedNote.click()
    await expect(title).toHaveValue('Renamed in sidebar')
  })

  test('archives note via context menu into Archive folder', async ({ page }) => {
    const title = page.getByTestId('notes-meeting-title')
    await title.fill('Note to archive')

    const noteRow = page.locator('[data-testid^="notes-note-row-"]').filter({ hasText: 'Note to archive' })
    await noteRow.click({ button: 'right' })
    await expect(page.getByTestId('notes-ctx-archive')).toBeVisible()
    await page.getByTestId('notes-ctx-archive').click()

    await expect(page.getByTestId('notes-folder-toggle-__inbox__')).toContainText('(0)')
    await expect(page.getByRole('button', { name: /Archive \(1\)/ })).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: 'Note to archive' })).toBeVisible()
  })

  test('switching notes does not reorder vault by last opened', async ({ page }) => {

    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('')
    await page.keyboard.type('Note Alpha')

    await page.getByTestId('notes-new-meeting').click()
    await title.click()
    await title.fill('')
    await page.keyboard.type('Note Beta')

    const noteLabels = () =>
      page.locator('[data-testid^="notes-meeting-item-"] .truncate').allTextContents()

    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)
    const orderBefore = await noteLabels()
    expect(orderBefore[0]).toMatch(/Note\s*Beta/i)

    await page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: /Note\s*Alpha/i }).click()
    await expect(title).toHaveValue(/Note\s*Alpha/)

    const orderAfter = await noteLabels()
    expect(orderAfter).toEqual(orderBefore)
  })

  test('switch stays on selected note after save sync completes', async ({ page }) => {

    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('')
    await page.keyboard.type('Note Alpha')
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('alpha body')

    await page.getByTestId('notes-new-meeting').click()
    await title.click()
    await title.fill('')
    await page.keyboard.type('Note Beta')
    await editor.click()
    await page.keyboard.type('beta body')

    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)

    await page.keyboard.press('Control+s')
    await meetings.filter({ hasText: /Note\s*Alpha/i }).click()
    await expect(title).toHaveValue(/Note\s*Alpha/)
    await expect(editor).toContainText('alpha body')

    await page.waitForTimeout(1200)
    await expect(title).toHaveValue(/Note\s*Alpha/)
    await expect(editor).toContainText('alpha body')

    await meetings.filter({ hasText: /Note\s*Beta/i }).click()
    await expect(title).toHaveValue(/Note\s*Beta/)
    await expect(editor).toContainText('beta body')
  })

  test('note switch updates editor within 500ms', async ({ page }) => {
    const title = page.getByTestId('notes-meeting-title')
    const editor = notesEditor(page)

    await title.click()
    await title.fill('')
    await page.keyboard.type('Fast Alpha')
    await editor.click()
    await page.keyboard.type('alpha-fast-content')

    await page.getByTestId('notes-new-meeting').click()
    await title.click()
    await title.fill('')
    await page.keyboard.type('Fast Beta')
    await editor.click()
    await page.keyboard.type('beta-fast-content')

    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    const t0 = Date.now()
    await meetings.filter({ hasText: /Fast\s*Alpha/i }).click()
    await expect.poll(async () => (await editor.innerText()).includes('alpha-fast-content'), { timeout: 500 }).toBe(true)
    expect(Date.now() - t0).toBeLessThan(500)
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

  test('panel lookup input runs AI without typing in editor', async ({ page }) => {
    await expect(page.getByTestId('notes-lookup-input')).toBeVisible()
    await page.getByTestId('notes-lookup-input').fill('fund TVPI ratio')
    await page.getByTestId('notes-lookup-input').press('Enter')
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('fund TVPI ratio?')
    await expect(page.getByTestId('notes-lookup-input')).toBeHidden()
    await expect(page.getByTestId('notes-followup-input')).toBeVisible()
  })

  test('switches between lookup chats with one composer visible', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('first topic?')
    await waitForNotesTrigger(page)
    await waitForLookupComplete(page)

    await editor.click()
    await page.keyboard.press('Enter')
    await page.keyboard.type('second topic?')
    await waitForNotesTrigger(page)
    await waitForLookupComplete(page)

    await expect(page.getByTestId('notes-lookup-input')).toBeHidden()
    await expect(page.getByTestId('notes-followup-input')).toBeVisible()

    const historyButtons = page.locator('[data-testid^="notes-lookup-history-"]')
    await expect(historyButtons).toHaveCount(2)
    await historyButtons.nth(1).click()
    await expect(historyButtons.nth(1)).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('notes-side-panel')).toContainText('first topic?')

    await historyButtons.first().click()
    await expect(historyButtons.first()).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('notes-side-panel')).toContainText('second topic?')
    await expect(page.getByTestId('notes-lookup-input')).toBeHidden()

    await page.getByTestId('notes-clear-lookup').click()
    await expect(page.getByTestId('notes-lookup-input')).toBeVisible()
    await expect(page.getByTestId('notes-followup-input')).toBeHidden()
  })

  test('section ?? trigger opens panel and shows mock AI response', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('LP stakes')
    await page.keyboard.press('Enter')
    await page.keyboard.type('GP fee??')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
  })

  test('follow-up question streams after first lookup', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('fund DPI?')
    await waitForNotesTrigger(page)
    await waitForLookupComplete(page)
    await expect(page.getByTestId('notes-chat-thread')).toContainText('E2E mock answer', { timeout: 15_000 })

    await page.getByTestId('notes-followup-input').fill('How does it relate to TVPI?')
    await page.getByTestId('notes-followup-input').press('Enter')
    await expect(page.getByTestId('notes-chat-user')).toContainText('TVPI', { timeout: 5000 })
    await expect(page.getByTestId('notes-chat-thread')).toContainText('E2E mock answer', { timeout: 15_000 })
    await expect(page.getByTestId('notes-chat-assistant')).toHaveCount(2, { timeout: 15_000 })
  })

  test('cloud sync does not wipe in-flight lookup', async ({ page }) => {
    await page.route('**/api/notes/sessions**', async (route) => {
      await new Promise((r) => setTimeout(r, 2500))
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessions: [] }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('fund DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 20_000 })
  })

  test('sync password uses shared userId on save', async ({ page }) => {
    let postedUserId = ''
    await page.route('**/api/notes/sessions**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { userId?: string }
        postedUserId = body.userId ?? ''
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    await ensureNotesPanelOpen(page)
    await expect(page.getByTestId('notes-sync-section')).toBeVisible()
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-sync-password-input').fill('my-sync-password-99')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByText('Synced', { exact: false })).toBeVisible({ timeout: 10_000 })
    expect(postedUserId).toBe('my-sync-password-99')
  })

  test('owner vault POST 403 surfaces API error in sync panel', async ({ page }) => {
    const deviceDenied = 'Owner vault requires a registered sfjc.dev admin device.'
    await page.addInitScript(() => {
      localStorage.setItem('notes_user_id', 'non-admin-device-uuid')
    })
    await page.route('**/api/notes/sessions**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 403, json: { error: deviceDenied } })
        return
      }
      await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    await ensureNotesPanelOpen(page)
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-sync-password-input').fill('MLpnko#12')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByTestId('notes-sync-panel')).toContainText(deviceDenied, { timeout: 10_000 })
    await expect(page.getByTestId('notes-device-unregistered-warning')).toBeVisible()
  })

  test('global search opens with Ctrl+Shift+F', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('> follow up MOIC')
    await page.keyboard.press('Control+Shift+F')
    await expect(page.getByTestId('notes-global-search')).toBeVisible()
    await page.getByTestId('notes-search-input').fill('MOIC')
    await expect(page.getByTestId('notes-search-hit').first()).toBeVisible()
  })

  test('home link returns to root', async ({ page }) => {
    await page.getByTestId('notes-home-link').click()
    await expect(page).toHaveURL('/')
  })

  test('parallel line? lookups both complete', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('MOIC?')
    await waitForNotesTrigger(page)
    await page.keyboard.press('Enter')
    await page.keyboard.type('TVPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
    await expect(page.getByTestId('notes-ai-section')).toContainText(/MOIC|TVPI/)
  })

  test('shorthand hints toggle', async ({ page }) => {
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByTestId('notes-statusbar')).toContainText('AI line')
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByTestId('notes-shorthand-toggle')).toContainText('Hints')
  })

  test('Ctrl+Shift+N creates new note', async ({ page }) => {
    await ensureNotesPanelOpen(page)
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
    await page.keyboard.press('Control+Shift+N')
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(2)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
  })

  test('Meeting title normalizes to Note in localStorage', async ({ page }) => {
    await page.evaluate(() => {
      const session = {
        id: 'local-legacy-title',
        title: 'Meeting Jan 1, 2026',
        notes: '',
        tags: [],
        lookups: [],
        screenshots: {},
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Jan 1, 2026')
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

  test('trigger works with bold text in line', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('review DPI gap?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
  })

  test('todo line appears in rollup panel', async ({ page }) => {
    await typeInNotesEditor(page, '> follow up IC memo')
    await expect(page.getByTestId('notes-statusbar')).toContainText('1 todos', { timeout: 8000 })
    await expect(page.getByTestId('notes-rollup-panel')).toContainText('follow up IC memo', { timeout: 8000 })
  })

  test('tag chips toggle on note and persist in localStorage', async ({ page }) => {
    await expect(page.getByTestId('notes-tag-chip-IC')).toBeVisible()
    await page.getByTestId('notes-tag-chip-IC').click()
    await expect(page.getByTestId('notes-tag-chip-IC')).toHaveClass(/bg-\[var\(--uv-accent\)\]/)

    await page.getByTestId('notes-tag-input').fill('custom-tag')
    await page.getByTestId('notes-tag-input').press('Enter')
    await expect(page.getByTestId('notes-tag-chip-custom-tag')).toBeVisible()

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions') ?? '[]'
      const sessions = JSON.parse(raw) as { tags: string[] }[]
      return sessions[0]?.tags ?? []
    })
    expect(stored).toContain('IC')
    expect(stored).toContain('custom-tag')
  })

  test('Ctrl+S saves and shows Saved in status bar', async ({ page }) => {
    await typeInNotesEditor(page, 'autosave check')
    await page.keyboard.press('Control+s')
    await expect(page.getByTestId('notes-sync-label')).toContainText(/Saved|Synced/, { timeout: 10_000 })
  })

  test('note history records lookup and save events', async ({ page }) => {
    await typeInNotesEditor(page, 'fund DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })

    await page.keyboard.press('Control+s')
    await expect(page.getByTestId('notes-sync-label')).toContainText(/Saved|Synced/, { timeout: 10_000 })

    await page.getByTestId('notes-history-toggle').click()
    const hist = page.getByTestId('notes-history-panel')
    await expect(hist).toContainText('AI lookup', { timeout: 5000 })
    await expect(hist).toContainText(/Saved locally|Synced/)
  })

  test('*highlight* span gets decoration class', async ({ page }) => {
    await typeInNotesEditor(page, '*key term* in line')
    await expect(notesEditor(page).locator('.tiptap-highlight-span')).toContainText('key term', { timeout: 5000 })
  })

  test('no manual domain or kind pickers in UI', async ({ page }) => {
    await expect(page.getByTestId('notes-top-bar')).toBeVisible()
    await expect(page.locator('[data-testid*="domain"]')).toHaveCount(0)
    await expect(page.locator('[data-testid*="kind"]')).toHaveCount(0)
  })

  test('italic toggle via Ctrl+I', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('emphasis')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+i')
    await expect(editor.locator('em')).toContainText('emphasis')
  })

  test('font size applies to selection', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('large text')
    await page.keyboard.press('ControlOrMeta+a')
    await page.getByTestId('notes-font-size').selectOption('24px')
    const sized = editor.locator('span[style*="font-size"]')
    await expect(sized).toContainText('large text', { timeout: 5000 })
    await expect(sized).toHaveAttribute('style', /font-size:\s*24px/i)
  })

  test('- dash lines indent without bullet glyphs', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('- first item')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(1, { timeout: 5000 })
    await expect(editor).toContainText('- first item')
    await expect(editor.locator('ul li')).toHaveCount(0)
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

  test('paste plain unicode bullets normalizes to dash lines', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', '• alpha\n  • nested')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- alpha')
    await expect(editor).toContainText('- nested')
  })

  test('paste Google Docs nested list as indented dash lines', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<meta charset="utf-8"><ul><li>top level</li><ul><li>nested once</li><ul><li>nested twice</li></ul></ul></ul>',
      )
      dt.setData('text/plain', 'top level\nnested once\nnested twice')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor.locator('.notes-dash-line')).toHaveCount(3, { timeout: 5000 })
    await expect(editor).toContainText('- top level')
    await expect(editor).toContainText('  - nested once')
    await expect(editor).toContainText('    - nested twice')
    await expect(editor.locator('table')).toHaveCount(0)
  })

  test('paste Google Docs layout table bullets stay dash lines not table', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<table><tr><td></td><td>• first bullet</td></tr><tr><td></td><td style="padding-left:36pt">• nested bullet</td></tr></table>',
      )
      dt.setData('text/plain', 'first bullet\nnested bullet')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- first bullet')
    await expect(editor).toContainText('- nested bullet')
    await expect(editor.locator('table')).toHaveCount(0)
  })

  test('paste Google Docs single blank line stays one blank line', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<meta charset="utf-8"><p>First paragraph</p><p><br></p><p>Second paragraph</p>',
      )
      dt.setData('text/plain', 'First paragraph\n\nSecond paragraph')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    const lines = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      return [...root.children].map((el) => el.textContent ?? '')
    })
    expect(lines).toEqual(['First paragraph', '', 'Second paragraph'])
  })

  test('paste Google Docs double blank artifact collapses to one blank', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<meta charset="utf-8"><p>Line one</p><p></p><p><br></p><p>Line two</p>',
      )
      dt.setData('text/plain', 'Line one\n\nLine two')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    const lines = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      return [...root.children].map((el) => el.textContent ?? '')
    })
    expect(lines).toEqual(['Line one', '', 'Line two'])
  })

  test('paste Google Docs mixed paragraph and bullets', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<p>Intro <strong>bold</strong> text</p><ul><li>bullet A</li><li>bullet B</li></ul><p>Outro</p>',
      )
      dt.setData('text/plain', 'Intro bold text\nbullet A\nbullet B\nOutro')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor).toContainText('Intro bold text')
    await expect(editor).toContainText('- bullet A')
    await expect(editor).toContainText('- bullet B')
    await expect(editor).toContainText('Outro')
    await expect(editor.locator('strong')).toContainText('bold')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
  })

  test('paste Google Docs link preserves href', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData(
        'text/html',
        '<p>Visit <a href="https://example.com/docs">the docs</a> please</p>',
      )
      dt.setData('text/plain', 'Visit the docs please')
      const root = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror')!
      root.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })
    await expect(editor.locator('a[href="https://example.com/docs"]')).toContainText('the docs', { timeout: 5000 })
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

  test('backspace deletes characters without cursor jump', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('abcdef')
    await expect(editor).toContainText('abcdef')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
    await expect(editor).toContainText('abc')
    await expect(editor).not.toContainText('def')
    await page.keyboard.type('xyz')
    await expect(editor).toContainText('abcxyz')
  })

  test('backspace on empty dash prefix removes marker', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('- ')
    await page.keyboard.press('Backspace')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(0, { timeout: 5000 })
  })

  test('typing * with selection wraps highlight shorthand', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('wrap me')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Shift+8')
    await expect(editor.locator('.tiptap-highlight-span')).toContainText('wrap me', { timeout: 5000 })
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

  test('selection + minus bullettizes all lines', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('first line')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second line')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('-')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- first line')
    await expect(editor).toContainText('- second line')
  })

  test('Tab indents multiple dash lines; Shift+Tab outdents without losing bullets', async ({ page }) => {
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('- alpha')
    await page.keyboard.press('Enter')
    await page.keyboard.type('- beta')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Tab')
    await expect(editor.locator('.notes-dash-line[data-dash-indent="2"]')).toHaveCount(2, { timeout: 5000 })
    await page.keyboard.press('Shift+Tab')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- alpha')
    await expect(editor).toContainText('- beta')
    await page.keyboard.press('Shift+Tab')
    await expect(editor.locator('.notes-dash-line')).toHaveCount(2, { timeout: 5000 })
    await expect(editor).toContainText('- alpha')
  })

  test('Ctrl+Shift+V pastes plain text without rich formatting', async ({ page }) => {
    const editor = notesEditor(page)
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('plain **not bold**')
    })
    await editor.click()
    await page.keyboard.press('Control+Shift+V')
    await expect(editor).toContainText('plain **not bold**', { timeout: 5000 })
    await expect(editor.locator('strong')).toHaveCount(0)
  })

  test('status bar shows Cmd labels when Mac platform is detected', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
    await expect(page.getByTestId('notes-toggle-panel').locator('kbd')).toContainText('Cmd+\\')
    await expect(page.getByTestId('notes-search-btn').locator('kbd')).toContainText('Cmd+Shift+F')
  })
})
