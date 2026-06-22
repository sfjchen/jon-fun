import { test, expect } from '@playwright/test'

import { mockUvimcoNotesApi } from './helpers/uvimco-notes-mock'

const SESSIONS_KEY = 'uvimco_notes_sessions'

test.describe('Notes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockUvimcoNotesApi(page)
    await page.goto('/games/uvimco-notes')
    await page.evaluate((key) => {
      try {
        localStorage.removeItem(key)
        localStorage.removeItem('uvimco_notes_active_session_id')
        localStorage.removeItem('uvimco_notes_user_id')
        localStorage.removeItem('notes_ui_prefs')
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
    await page.getByTestId('notes-meetings-toggle').click()
    await expect(page.getByTestId('notes-new-meeting')).toBeVisible()
    await expect(page.locator('[data-testid^="notes-meeting-item-"]')).toHaveCount(1)
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
    await page.keyboard.type('boss flagged ?DPI gap')

    await page.getByTestId('notes-new-meeting').click()
    await expect(title).not.toHaveValue('IC standup')

    const meetings = page.locator('[data-testid^="notes-meeting-item-"]')
    await expect(meetings).toHaveCount(2)
    await meetings.nth(1).click()
    await expect(title).toHaveValue('IC standup')
    await expect(editor).toContainText('?DPI')
  })

  test('?term trigger opens panel and shows mock AI response', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('review ?DPI ')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('?term + Enter opens panel and shows mock AI response', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('review ?MOIC')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('hyphenated ?term + space triggers lookup', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('?LP-GP ')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('line ending with ? triggers on Enter', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('LTP underweight this quarter?')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('follow-up question streams after first lookup', async ({ page }) => {
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('?DPI ')
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('notes-followup-input').fill('How does it relate to TVPI?')
    await page.getByTestId('notes-followup-input').press('Enter')
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('cloud sync does not wipe in-flight lookup', async ({ page }) => {
    await page.route('**/api/uvimco-notes/sessions**', async (route) => {
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

    await page.goto('/games/uvimco-notes')
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 15000 })
    const editor = page.locator('.uvimco-cm .cm-content')
    await editor.click()
    await page.keyboard.type('?DPI ')
    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 20_000 })
  })

  test('home link returns to root', async ({ page }) => {
    await page.getByTestId('notes-home-link').click()
    await expect(page).toHaveURL('/')
  })

  test('/games/notes redirects to app', async ({ page }) => {
    await page.goto('/games/notes')
    await expect(page).toHaveURL(/\/games\/uvimco-notes/)
    await expect(page.getByTestId('notes-editor')).toBeVisible({ timeout: 15000 })
  })

  test('shorthand hints toggle', async ({ page }) => {
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByText(/AI lookup/)).toBeVisible()
    await page.getByTestId('notes-shorthand-toggle').click()
    await expect(page.getByText('Ctrl+B/I/U')).toBeVisible()
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
        lookups: [],
        screenshots: {},
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      localStorage.setItem('uvimco_notes_sessions', JSON.stringify([session]))
      localStorage.setItem('uvimco_notes_active_session_id', session.id)
    })
    await page.reload()
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Jan 1, 2026')
  })
})
