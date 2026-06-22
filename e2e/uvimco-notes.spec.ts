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

  test('home link returns to root', async ({ page }) => {
    await page.getByTestId('notes-home-link').click()
    await expect(page).toHaveURL('/')
  })
})
