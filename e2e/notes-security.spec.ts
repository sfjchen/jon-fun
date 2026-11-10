import { test, expect } from '@playwright/test'
import { buildSessionMarkdown } from '../src/lib/notes/export'
import type { NoteSession } from '../src/lib/notes/types'
import {
  mockNotesApi,
  notesEditor,
  waitForNotesEditor,
} from './helpers/notes-mock'

test.describe('Notes security', () => {
  test.use({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
    })
  })

  test('markdown export HTML-escapes malicious title and tags', async () => {
    const session: NoteSession = {
      id: 'xss-test',
      title: '<img src=x onerror=alert(1)>',
      notes: 'body',
      tags: ['<script>evil</script>'],
      metadata: {},
      lookups: [],
      screenshots: {},
      startedAt: '2026-06-25T12:00:00.000Z',
      updatedAt: '2026-06-25T12:00:00.000Z',
    }
    const md = buildSessionMarkdown(session)
    expect(md).toContain('# &lt;img src=x onerror=alert(1)&gt;')
    expect(md).toContain('`&lt;script&gt;evil&lt;/script&gt;`')
    expect(md).not.toContain('<img src=x')
    expect(md).not.toContain('<script>')
  })

  test('U+2028 in notes syncs without 500 and shows sync status', async ({ page }) => {
    let postBody = ''
    await page.route('**/api/notes/sessions**', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        postBody = route.request().postData() ?? ''
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [] }),
      })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()
    await page.keyboard.type('line with separator\u2028here', { delay: 10 })

    await expect(page.getByTestId('notes-statusbar')).toContainText(/Saved|Synced/, { timeout: 15_000 })
    expect(postBody).toBeTruthy()
    expect(postBody).not.toContain('\u2028')
    expect(postBody).toContain('line with separator')
  })

})
