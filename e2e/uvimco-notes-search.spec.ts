import { test, expect } from '@playwright/test'

test.describe('Notes search (local)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const session = {
        id: 'search-test',
        title: 'IC Meeting',
        notes: '> follow up on MOIC\n* key term alpha',
        tags: ['IC'],
        metadata: { meetingAt: new Date().toISOString() },
        lookups: [],
        screenshots: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('uvimco_notes_sessions', JSON.stringify([session]))
      localStorage.setItem('uvimco_notes_active_session_id', session.id)
      localStorage.setItem('uvimco_notes_user_id', `e2e-search-${Date.now()}`)
    })

    await page.route('**/api/uvimco-notes/sessions**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
      } else {
        await route.fulfill({ json: { ok: true } })
      }
    })

    await page.goto('/games/notes')
    await page.waitForSelector('.uvimco-cm .cm-content', { timeout: 20_000 })
  })

  test('Ctrl+Shift+F opens search and finds todo', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F')
    await expect(page.getByTestId('notes-global-search')).toBeVisible()
    await page.getByTestId('notes-search-input').fill('MOIC')
    await expect(page.getByTestId('notes-search-hit').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('notes-search-hit').first()).toContainText(/MOIC|follow/i)
  })
})
