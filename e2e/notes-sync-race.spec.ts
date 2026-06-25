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
      localStorage.removeItem('notes_sync_key')
      localStorage.removeItem('notes_user_id')
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

  test('slow network save during typing keeps final text intact', async ({ page }) => {
    await page.route('**/api/notes/sessions**', async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessions: [] }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto('/games/notes')
    await waitForNotesEditor(page)
    const editor = notesEditor(page)
    await editor.click()

    await page.keyboard.type('line one\n', { delay: 20 })
    await page.keyboard.type('line two\n', { delay: 20 })
    await page.keyboard.type('line three', { delay: 20 })

    await expect(editor).toContainText('line three')
    await expect(page.getByTestId('notes-statusbar')).toContainText(/Saved|Synced/, { timeout: 20_000 })

    const text = await editor.innerText()
    expect(text).toContain('line one')
    expect(text).toContain('line two')
    expect(text).toContain('line three')
    expect((text.match(/line one/g) ?? []).length).toBe(1)
    expect((text.match(/line two/g) ?? []).length).toBe(1)
    expect((text.match(/line three/g) ?? []).length).toBe(1)
  })

  test('two tabs: active tab keeps local edits during stale pull', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pageA = await ctx.newPage()
    const pageB = await ctx.newPage()

    const sharedUserId = `e2e-two-tab-${Date.now()}`
    const seedScript = (userId: string) => {
      localStorage.setItem('notes_user_id', userId)
      localStorage.removeItem('notes_sync_key')
      const session = {
        id: 'shared-note',
        title: 'Shared',
        notes: 'seed',
        tags: [],
        metadata: {},
        lookups: [],
        screenshots: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('notes_sessions', JSON.stringify([session]))
      localStorage.setItem('notes_active_session_id', session.id)
    }

    let serverSnapshot = 'seed'
    const routeHandler = async (route: import('@playwright/test').Route) => {
      await new Promise((r) => setTimeout(r, 400))
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sessions: [
              {
                id: 'shared-note',
                title: 'Shared',
                notes: serverSnapshot,
                tags: [],
                metadata: {},
                lookups: [],
                screenshots: {},
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
        return
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON() as { sessions?: { notes?: string }[] }
        serverSnapshot = body.sessions?.find((s) => s.notes != null)?.notes ?? serverSnapshot
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }

    for (const p of [pageA, pageB]) {
      await mockNotesApi(p)
      await p.route('**/api/notes/sessions**', routeHandler)
      await p.addInitScript(seedScript, sharedUserId)
    }

    await pageA.goto('/games/notes')
    await pageB.goto('/games/notes')
    await waitForNotesEditor(pageA)
    await waitForNotesEditor(pageB)

    const editorA = notesEditor(pageA)
    const editorB = notesEditor(pageB)
    await editorA.click()
    await pageA.keyboard.press('Meta+A')
    await pageA.keyboard.type('tab-a-final', { delay: 10 })

    await editorB.click()
    await pageB.keyboard.press('Meta+A')
    await pageB.keyboard.type('tab-b-should-not-win', { delay: 10 })

    await pageA.waitForTimeout(2500)
    await expect(editorA).toContainText('tab-a-final')
    expect(await editorA.innerText()).not.toContain('tab-b-should-not-win')

    await ctx.close()
  })
})
