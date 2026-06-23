import { test, expect } from '@playwright/test'

import {
  LEGACY_SESSIONS_KEY,
  mockNotesApi,
  SESSIONS_KEY,
  waitForNotesTrigger,
} from './helpers/notes-mock'

test.describe('Notes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes')
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
    await page.reload()
  })

  test('loads full-width editor; panel hidden by default', async ({ page }) => {
    await expect(page.getByTestId('notes-meeting-title')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.uvimco-cm .cm-content')).toBeVisible({ timeout: 15000 })
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
    await expect(page.getByTestId('notes-sync-panel')).toBeVisible()
    await page.getByTestId('notes-meetings-toggle').click()
    await expect(page.getByTestId('notes-new-meeting')).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
  })

  test('builtin domain packs seed in Sources panel', async ({ page }) => {
    await page.getByTestId('notes-toggle-panel').click()
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

    const editor = page.locator('.uvimco-cm .cm-content')
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
    const editor = page.locator('.uvimco-cm .cm-content')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('review DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText(/Core meaning/i)
  })

  test('section ?? trigger opens panel and shows mock AI response', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('LP stakes')
    await page.keyboard.press('Enter')
    await page.keyboard.type('GP fee??')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
  })

  test('follow-up question streams after first lookup', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('fund DPI?')
    await waitForNotesTrigger(page)
    await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15000 })
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
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 15000 })
    const editor = page.locator('.uvimco-cm .cm-content')
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
    await page.getByTestId('notes-toggle-panel').click()
    await page.getByTestId('notes-sync-key-input').fill('my-sync-key-99')
    await page.getByTestId('notes-sync-save').click()
    await expect(page.getByText('Synced', { exact: false })).toBeVisible({ timeout: 10_000 })
    expect(postedUserId).toBe('my-sync-key-99')
  })

  test('global search opens with Ctrl+Shift+F', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
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
    await expect(page.locator('.uvimco-cm .cm-content')).toContainText('legacy body')

    const migrated = await page.evaluate((key) => localStorage.getItem(key), SESSIONS_KEY)
    expect(migrated).toContain('legacy-migrate')
  })

  test('shorthand hints toggle', async ({ page }) => {
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByText('AI explain line')).toBeVisible()
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
    await page.addInitScript(() => {
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
    await page.reload()
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Jan 1, 2026')
  })
})
