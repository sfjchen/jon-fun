import { test, expect } from '@playwright/test'
import { mockNotesApi, waitForNotesEditor } from './helpers/notes-mock'

test.describe('Notes image attachments', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
  })

  test('restored attachment marker renders image when screenshot map present', async ({ page }) => {
    await page.evaluate(() => {
      const id = 'screenshot-e2e-restore'
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      const session = {
        id: 'attach-restore',
        title: 'Attach restore',
        notes: `[📷 ${id}]`,
        tags: [],
        metadata: { meetingAt: new Date().toISOString() },
        lookups: [],
        screenshots: { [id]: { id, base64, mimeType: 'image/png' } },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    })
    await page.reload()
    await waitForNotesEditor(page)
    await expect(page.getByTestId('notes-attachment-img')).toBeVisible({ timeout: 10_000 })
  })
})
