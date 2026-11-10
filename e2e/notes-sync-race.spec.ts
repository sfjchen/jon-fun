import { test, expect } from '@playwright/test'
import {
  mockNotesApi,
  notesEditor,
  waitForNotesEditor,
  SESSIONS_KEY,
} from './helpers/notes-mock'

test.describe('Notes sync race / fast typing', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await mockNotesApi(page)
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
    })
  })

  test('rapid typing survives delayed stale remote pull', async ({ page }) => {
    let serverNotes = ''
    await page.route('**/api/notes/sessions**', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await new Promise((r) => setTimeout(r, 1200))
        const sessions = serverNotes
          ? [
              {
                id: 'stale-session',
                title: '',
                notes: serverNotes,
                tags: [],
                metadata: {},
                lookups: [],
                screenshots: {},
                startedAt: new Date().toISOString(),
                updatedAt: new Date(Date.now() - 60_000).toISOString(),
              },
            ]
          : []
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessions }),
        })
        return
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON() as {
          sessions?: { notes?: string }[]
        }
        serverNotes = body.sessions?.[0]?.notes ?? serverNotes
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()

    const phrase = 'alpha beta gamma delta epsilon'
    await page.keyboard.type(phrase, { delay: 15 })

    await expect(editor).toContainText(phrase)
    await expect(page.getByTestId('notes-statusbar')).toContainText(/Saved|Synced/, { timeout: 15_000 })
    await expect(editor).toContainText(phrase)

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (!raw) return ''
      const arr = JSON.parse(raw) as { notes?: string }[]
      return arr[0]?.notes ?? ''
    }, SESSIONS_KEY)
    expect(stored).toBe(phrase)
    expect(stored).not.toContain(phrase + phrase)
  })

  test('pressSequentially fast burst does not duplicate content', async ({ page }) => {
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()

    const chunk = 'The quick brown fox jumps over the lazy dog. '
    for (let i = 0; i < 5; i++) {
      await editor.pressSequentially(chunk, { delay: 5 })
    }
    const expected = chunk.repeat(5).trimEnd()

    await page.waitForTimeout(1200)
    const text = await editor.innerText()
    expect(text.replace(/\s+/g, ' ').trim()).toBe(expected.replace(/\s+/g, ' ').trim())

    const count = (text.match(/quick brown fox/g) ?? []).length
    expect(count).toBe(5)
  })

})
