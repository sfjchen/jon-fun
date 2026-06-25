import { test, expect } from '@playwright/test'
import { buildSessionMarkdown } from '../src/lib/notes/export'
import type { NoteSession } from '../src/lib/notes/types'
import {
  mockNotesApi,
  notesEditor,
  SESSIONS_KEY,
  waitForNotesEditor,
} from './helpers/notes-mock'

test.describe('Notes security', () => {
  test.use({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })

  test.beforeEach(async ({ page }) => {
    await mockNotesApi(page)
    await page.addInitScript(() => {
      localStorage.removeItem('notes_sessions')
      localStorage.removeItem('notes_active_session_id')
      localStorage.removeItem('notes_sync_key')
      localStorage.removeItem('notes_user_id')
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

  test('tag input strips HTML and enforces length', async ({ page }) => {
    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const input = page.getByTestId('notes-tag-input')
    await input.fill('<b>x</b>' + 'a'.repeat(80))
    await input.press('Enter')
    const chip = page.locator('[data-testid^="notes-tag-chip-"]').last()
    await expect(chip).toBeVisible()
    const text = await chip.innerText()
    expect(text).not.toContain('<')
    expect(text.length).toBeLessThanOrEqual(64)
  })

  test('delete in another tab clears editor when that note was open', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pageA = await ctx.newPage()
    const pageB = await ctx.newPage()
    const userId = `e2e-del-${Date.now()}`

    const seed = (uid: string) => {
      localStorage.setItem('notes_user_id', uid)
      const a = {
        id: 'note-a',
        title: 'Keep',
        notes: 'keep',
        tags: [],
        metadata: {},
        lookups: [],
        screenshots: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const b = { ...a, id: 'note-b', title: 'Delete me', notes: 'delete' }
      localStorage.setItem('notes_sessions', JSON.stringify([a, b]))
      localStorage.setItem('notes_active_session_id', 'note-b')
    }

    for (const p of [pageA, pageB]) {
      await mockNotesApi(p)
      await p.addInitScript(seed, userId)
    }

    await pageA.goto('/games/notes')
    await pageB.goto('/games/notes')
    await waitForNotesEditor(pageA)
    await waitForNotesEditor(pageB)

    await pageA.evaluate((key) => {
      const raw = localStorage.getItem(key)!
      const sessions = JSON.parse(raw).filter((s: { id: string }) => s.id !== 'note-b')
      localStorage.setItem(key, JSON.stringify(sessions))
      localStorage.setItem('notes_active_session_id', sessions[0].id)
    }, SESSIONS_KEY)

    await pageB.waitForTimeout(500)
    await expect(pageB.getByTestId('notes-meeting-title')).toHaveValue('Keep')

    await ctx.close()
  })
})
