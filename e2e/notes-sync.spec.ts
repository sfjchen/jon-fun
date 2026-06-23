import { test, expect } from '@playwright/test'
import { notesEditor, waitForNotesEditor } from './helpers/notes-mock'

/**
 * Real Supabase sync on **deployed** sfjc.dev (no session API mocks).
 *
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test e2e/notes-sync.spec.ts
 */
const isDeploy = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

test.describe('Notes cloud sync', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('shows Saved after typing when Supabase table exists', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to test deployed sfjc.dev')

    const userId = `e2e-sync-${Date.now()}`
    const noteText = `deploy sync ${Date.now()}`

    await page.addInitScript((id) => {
      localStorage.setItem('notes_user_id', id)
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
      localStorage.removeItem('notes_ui_prefs')
    }, userId)

    await page.route('**/api/notes/lookup', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: ${JSON.stringify({ token: 'mock' })}\n\ndata: [DONE]\n\n`,
      })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)

    const statusBar = page.getByTestId('notes-statusbar')
    await expect(statusBar).toContainText('Saved', { timeout: 15_000 })

    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type(noteText)

    await expect(statusBar).toContainText(/Saving…|Saved/, { timeout: 5000 })
    await expect(statusBar).toContainText('Saved', { timeout: 15_000 })
    await expect(editor).toContainText(noteText)

    const apiRes = await page.request.get(
      `/api/notes/sessions?userId=${encodeURIComponent(userId)}`,
    )
    expect(apiRes.ok()).toBeTruthy()
    const body = (await apiRes.json()) as { sessions?: { notes?: string }[] }
    const notes = body.sessions?.map((s) => s.notes ?? '').join('\n') ?? ''
    expect(notes).toContain(noteText)
  })

  test('legacy Meeting title migrates to Note on load', async ({ page }) => {
    test.skip(!isDeploy, 'Set PLAYWRIGHT_SKIP_WEBSERVER=1 to test deployed sfjc.dev')

    await page.addInitScript(() => {
      const session = {
        id: 'legacy-title-test',
        title: 'Meeting Jun 22, 2026',
        notes: '',
        lookups: [],
        screenshots: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
      localStorage.setItem('notes_user_id', `e2e-legacy-${Date.now()}`)
    })

    await page.goto('/games/notes')
    await expect(page.getByTestId('notes-meeting-title')).toHaveValue('Note Jun 22, 2026', {
      timeout: 15_000,
    })
  })
})
