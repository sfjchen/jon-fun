import { test, expect } from '@playwright/test'

test.describe('Notes sync restore (mock API)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('restore panel pulls sessions from server', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_sync_key')
      localStorage.setItem('notes_user_id', 'device-only-id')
      localStorage.setItem('notes_ui_prefs', JSON.stringify({ panelOpen: true }))
    })

    await page.route('**/api/notes/sessions**', async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'GET' && url.includes('userId=restore-key-123')) {
        await route.fulfill({
          json: {
            sessions: [
              {
                id: 'restored-session',
                title: 'Restored Note',
                notes: 'restored body text',
                tags: [],
                metadata: { meetingAt: new Date().toISOString() },
                lookups: [],
                screenshots: {},
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        })
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { sessions: [] } })
        return
      }
      await route.fulfill({ json: { ok: true } })
    })

    await page.route('**/api/notes/glossary**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { entries: [] } : { ok: true } })
    })
    await page.route('**/api/notes/sources**', async (route) => {
      await route.fulfill({ json: route.request().method() === 'GET' ? { sources: [] } : { ok: true } })
    })

    await page.goto('/games/notes')
    await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('notes-sync-panel')).toBeVisible()

    await page.getByTestId('notes-restore-key-input').fill('restore-key-123')
    await page.getByTestId('notes-restore-btn').click()

    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Restored Note', { timeout: 10_000 })
    await expect(page.locator('.uvimco-cm .cm-content')).toContainText('restored body text')
  })
})
