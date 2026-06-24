import { test, expect } from '@playwright/test'

import {
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
      } catch {
        /* ignore */
      }
    }, SESSIONS_KEY)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForNotesEditor(page)
  })

  test('loads full-width editor; panel hidden by default', async ({ page }) => {
    await expect(page.getByTestId('notes-meeting-title')).toBeVisible({ timeout: 10000 })
    await expect(notesEditor(page)).toBeVisible({ timeout: 15000 })
    const editorBox = await page.getByTestId('notes-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(280)
    await expect(page.getByTestId('notes-side-panel')).toBeHidden()
    await expect(page.getByTestId('notes-meeting-title')).toHaveAttribute('placeholder', 'Untitled')
  })

  test('panel opens with collapsible notes + AI sections', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-meetings-section')).toBeVisible()
    await expect(page.getByTestId('notes-ai-toggle')).toBeVisible()
    await expect(page.getByTestId('notes-sync-section')).toBeVisible()
    await expect(page.getByTestId('notes-sync-panel')).toBeHidden()
    await expect(page.getByTestId('notes-new-meeting')).toBeVisible()
    await expect(page.getByTestId('notes-vault-panel')).toBeVisible()
    await expect(page.getByTestId('notes-folder-inbox')).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
  })

  test('creates nested subfolder and moves note via drag and drop', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
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
    const icDrop = page.locator('[data-testid^="notes-folder-drop-"]').filter({ hasText: 'IC' })
    await noteRow.dragTo(icDrop)

    await expect(page.getByTestId('notes-folder-toggle-__inbox__')).toContainText('(0)')
    await expect(page.locator('button[data-testid^="notes-folder-toggle-"]').filter({ hasText: 'IC' })).toContainText('(1)')
  })

  test('creates folder and nests note', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
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
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-sources-toggle').click()
    await expect(page.getByTestId('notes-sources-panel')).toBeVisible()
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] UVIMCO endowment')
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] CFA Level I')
  })

  test('source checkboxes are per-note and attach file works', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-sources-toggle').click()

    const panel = page.getByTestId('notes-sources-panel')
    await expect(panel).toBeVisible()

    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('')
    await page.keyboard.type('Source note A')

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
    await page.getByTestId('notes-toggle-panel').click()

    const title = page.getByTestId('notes-meeting-title')
    await title.click()
    await title.fill('')
    await page.keyboard.type('IC standup')
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

  test('switching notes does not reorder vault by last opened', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()

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
    expect(orderBefore[0]).toContain('Note Beta')

    await page.locator('[data-testid^="notes-meeting-item-"]').filter({ hasText: 'Note Alpha' }).click()
    await expect(title).toHaveValue('Note Alpha')

    const orderAfter = await noteLabels()
    expect(orderAfter).toEqual(orderBefore)
  })

  test('switch stays on selected note after save sync completes', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()

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
    await meetings.filter({ hasText: 'Note Alpha' }).click()
    await expect(title).toHaveValue('Note Alpha')
    await expect(editor).toContainText('alpha body')

    await page.waitForTimeout(1200)
    await expect(title).toHaveValue('Note Alpha')
    await expect(editor).toContainText('alpha body')

    await meetings.filter({ hasText: 'Note Beta' }).click()
    await expect(title).toHaveValue('Note Beta')
    await expect(editor).toContainText('beta body')
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
    await page.getByTestId('notes-toggle-panel').click()
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
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-sync-section')).toBeVisible()
    await page.getByTestId('notes-sync-toggle').click()
    await page.getByTestId('notes-sync-password-input').fill('my-sync-password-99')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByText('Synced', { exact: false })).toBeVisible({ timeout: 10_000 })
    expect(postedUserId).toBe('my-sync-password-99')
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
    await page.getByTestId('notes-toggle-panel').click()
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

    await page.getByTestId('notes-toggle-panel').click()
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
    await page.getByTestId('notes-toggle-panel').click()
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
    await expect(page.getByTestId('notes-sync-label')).toContainText('Saved', { timeout: 10_000 })
  })

  test('note history records lookup and save events', async ({ page }) => {
    await typeInNotesEditor(page, 'fund DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })

    await page.keyboard.press('Control+s')
    await expect(page.getByTestId('notes-sync-label')).toContainText('Saved', { timeout: 10_000 })

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
})
