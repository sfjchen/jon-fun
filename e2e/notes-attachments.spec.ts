import { test, expect } from '@playwright/test'
import {
  mockNotesApi,
  notesEditor,
  waitForNotesEditor,
  waitForLookupComplete,
  waitForNotesTrigger,
} from './helpers/notes-mock'

/** 1×1 red PNG */
export const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Notes image attachments', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
  })

  test('file attach shows image in editor and persists screenshot data', async ({ page }) => {
    await page.getByTestId('notes-attach-file-input').setInputFiles({
      name: 'chart.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    })

    await expect(page.getByTestId('notes-attachment-img')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('notes-attachment-missing')).toHaveCount(0)

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('notes_sessions') ?? '[]'
      const sessions = JSON.parse(raw) as { notes: string; screenshots: Record<string, { base64: string }> }[]
      const session = sessions[0]
      if (!session) return { ok: false }
      const shotIds = Object.keys(session.screenshots ?? {})
      const hasBase64 = shotIds.some((id) => (session.screenshots[id]?.base64?.length ?? 0) > 10)
      const notesRef = shotIds.some((id) => session.notes.includes(id))
      return { ok: hasBase64 && notesRef, shotCount: shotIds.length }
    })
    expect(stored.ok).toBe(true)
    expect(stored.shotCount).toBeGreaterThan(0)
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

  test('follow-up attach shows preview and sends screenshot to lookup API', async ({ page }) => {
    let lookupScreenshots = 0
    await page.route('**/api/notes/lookup', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { screenshots?: unknown[] }
        lookupScreenshots = Array.isArray(body.screenshots) ? body.screenshots.length : 0
      }
      const sse =
        'data: {"token":"Core meaning\\nE2E mock answer for term lookup."}\n\n' +
        'data: [DONE]\n\n'
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse,
      })
    })

    await notesEditor(page).click()
    await page.keyboard.type('fund DPI?')
    await waitForNotesTrigger(page)
    await waitForLookupComplete(page)

    await page.getByTestId('notes-followup-file-input').setInputFiles({
      name: 'follow.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    })
    await expect(page.getByTestId('notes-followup-attachment-img')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('notes-followup-input').fill('What does this chart show?')
    await page.getByTestId('notes-followup-input').press('Enter')

    await expect.poll(() => lookupScreenshots).toBeGreaterThan(0)
    await expect(page.getByTestId('notes-followup-attachments')).toHaveCount(0, { timeout: 5000 })
  })
})
