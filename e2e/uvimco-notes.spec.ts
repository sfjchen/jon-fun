import { test, expect } from '@playwright/test'

import { mockUvimcoNotesApi } from './helpers/uvimco-notes-mock'

const SESSIONS_KEY = 'uvimco_notes_sessions'

test.describe('UVIMCO Notes', () => {
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

  test('loads workspace with meetings sidebar and editor', async ({ page }) => {
    await expect(page.getByTestId('uvimco-meetings-sidebar')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('uvimco-meeting-title')).toBeVisible()
    await expect(page.locator('.uvimco-cm .cm-content')).toBeVisible({ timeout: 15000 })
    const editorBox = await page.getByTestId('uvimco-editor').boundingBox()
    expect(editorBox?.height ?? 0).toBeGreaterThan(280)
    await expect(page.getByTestId('uvimco-ai-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Ctrl+B/I/U')).toBeVisible()
  })

  test('creates a second meeting and switches between them', async ({ page }) => {
    const title = page.getByTestId('uvimco-meeting-title')
    await title.click()
    await title.fill('')
    await page.keyboard.type('IC standup')
    await expect(title).toHaveValue('IC standup')
    const editor = page.locator('.uvimco-cm .cm-content')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('boss flagged ?DPI gap')

    await page.getByTestId('uvimco-new-meeting').click()
    await expect(page.getByTestId('uvimco-meeting-title')).not.toHaveValue('IC standup')

    const meetings = page.locator('[data-testid^="uvimco-meeting-item-"]')
    await expect(meetings).toHaveCount(2)

    await meetings.nth(1).click()
    await expect(page.getByTestId('uvimco-meeting-title')).toHaveValue('IC standup')
    await expect(editor).toContainText('?DPI')
  })

  test('?term trigger shows mock AI response', async ({ page }) => {
    await expect(page.getByTestId('uvimco-ai-panel')).toBeVisible({ timeout: 5000 })
    const editor = page.locator('.uvimco-cm .cm-content')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.type('review ?DPI ')

    await expect(page.getByText('E2E mock answer')).toBeVisible({ timeout: 15000 })
  })

  test('toggle AI panel hides and shows sidebar', async ({ page }) => {
    await expect(page.getByTestId('uvimco-ai-panel')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('uvimco-toggle-ai').click()
    await expect(page.getByTestId('uvimco-ai-panel')).toBeHidden()
    await page.getByTestId('uvimco-toggle-ai').click()
    await expect(page.getByTestId('uvimco-ai-panel')).toBeVisible()
  })

  test('home link returns to root', async ({ page }) => {
    await page.getByTestId('uvimco-home-link').click()
    await expect(page).toHaveURL('/')
  })
})
