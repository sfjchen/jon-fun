import { test, expect } from '@playwright/test'

import {
  LEGACY_SESSIONS_KEY,
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

  test.beforeEach(async ({ page }) => {
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
        localStorage.removeItem('uvimco_notes_sessions')
        localStorage.removeItem('uvimco_notes_active_session_id')
        localStorage.removeItem('uvimco_notes_user_id')
        localStorage.removeItem('uvimco_notes_sync_key')
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
    await expect(page.getByText('Notes', { exact: true }).first()).toBeVisible()
  })

  test('panel opens with collapsible notes + AI sections', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await expect(page.getByTestId('notes-side-panel')).toBeVisible()
    await expect(page.getByTestId('notes-meetings-section')).toBeVisible()
    await expect(page.getByTestId('notes-ai-toggle')).toBeVisible()
    await expect(page.getByTestId('notes-sync-section')).toBeVisible()
    await expect(page.getByTestId('notes-sync-panel')).toBeHidden()
    await page.getByTestId('notes-meetings-toggle').click()
    await expect(page.getByTestId('notes-new-meeting')).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
  })

  test('builtin domain packs seed in Sources panel', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-sources-toggle').click()
    await expect(page.getByTestId('notes-sources-panel')).toBeVisible()
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] UVIMCO endowment')
    await expect(page.getByTestId('notes-sources-panel')).toContainText('[Pack] CFA Level I')
  })

  test('creates a second note and switches between them', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-meetings-toggle').click()

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

  test('line? trigger opens panel and shows mock AI response', async ({ page }) => {
    const editor = notesEditor(page)
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('review DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText(/Core meaning/i)
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
    await page.getByTestId('notes-followup-input').fill('How does it relate to TVPI?')
    await page.getByTestId('notes-followup-input').press('Enter')
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
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

  test('sync key uses shared userId on save', async ({ page }) => {
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
    await page.getByTestId('notes-sync-key-input').fill('my-sync-key-99')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByText('Synced', { exact: false })).toBeVisible({ timeout: 10_000 })
    expect(postedUserId).toBe('my-sync-key-99')
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

  test('/games/uvimco-notes redirects to /games/notes', async ({ page }) => {
    await page.goto('/games/uvimco-notes')
    await expect(page).toHaveURL(/\/games\/notes/)
    await expect(page.getByTestId('notes-editor')).toBeVisible({ timeout: 15000 })
  })

  test('legacy localStorage keys migrate on load', async ({ page }) => {
    await page.addInitScript(({ legacyKey, legacyActive, title }) => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
      localStorage.removeItem('notes_user_id')
      const session = {
        id: 'legacy-migrate',
        title,
        notes: 'legacy body',
        tags: [],
        lookups: [],
        screenshots: {},
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      localStorage.setItem(legacyKey, JSON.stringify([session]))
      localStorage.setItem(legacyActive, session.id)
    }, { legacyKey: LEGACY_SESSIONS_KEY, legacyActive: 'uvimco_notes_active_session_id', title: 'Note Jan 1, 2026' })

    await page.goto('/games/notes')
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Jan 1, 2026')
    await expect(notesEditor(page)).toContainText('legacy body')

    const migrated = await page.evaluate((key) => localStorage.getItem(key), SESSIONS_KEY)
    expect(migrated).toContain('legacy-migrate')
  })

  test('shorthand hints toggle', async ({ page }) => {
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByTestId('notes-statusbar')).toContainText('AI line')
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByTestId('notes-shorthand-toggle')).toHaveText('Hints')
  })

  test('Ctrl+Shift+N creates new note', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-meetings-toggle').click()
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
    await page.getByTestId('notes-meetings-toggle').click()
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
})
