import { expect, type Page, type Locator } from '@playwright/test'

/** Tiptap ProseMirror content area. */
export function notesEditor(page: Page): Locator {
  return page.locator('[data-testid="notes-tiptap-editor"] .ProseMirror')
}

/** Wait for Tiptap editor to mount. */
export async function waitForNotesEditor(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="notes-tiptap-editor"] .ProseMirror', { timeout: 25_000 })
}

/** Stub Notes sync, lookup, embed, glossary, and sources routes for offline E2E. */
export async function mockNotesApi(page: Page): Promise<void> {
  await page.route('**/api/notes/sessions**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [] }),
      })
      return
    }
    if (method === 'POST' || method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    await route.continue()
  })

  await page.route('**/api/notes/glossary**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.route('**/api/notes/sources**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sources: [] }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.route('**/api/notes/embed', async (route) => {
    let body: { query?: string; excerpts?: string[] } = {}
    try {
      body = route.request().postDataJSON() as { query?: string; excerpts?: string[] }
    } catch {
      /* empty */
    }
    const excerpts = Array.isArray(body.excerpts) ? body.excerpts : []
    const scores = excerpts.map((ex, i) =>
      ex.toLowerCase().includes(String(body.query ?? '').toLowerCase().slice(0, 4)) ? 0.9 - i * 0.05 : 0.2,
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ scores, model: 'gemini-embedding-001' }),
    })
  })

  await page.route('**/api/notes/lookup', async (route) => {
    const sse =
      'data: {"token":"Core meaning\\nE2E mock answer for term lookup."}\n\n' +
      'data: [DONE]\n\n'
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: sse,
    })
  })
}

/** @deprecated use mockNotesApi */
export const mockUvimcoNotesApi = mockNotesApi

/** Type into Tiptap (insertText fires ProseMirror input events). */
export async function typeInNotesEditor(page: Page, text: string): Promise<void> {
  await waitForNotesEditor(page)
  await notesEditor(page).click()
  await page.evaluate((t) => {
    const el = document.querySelector('[data-testid="notes-tiptap-editor"] .ProseMirror') as HTMLElement | null
    if (!el) return
    el.focus()
    document.execCommand('insertText', false, t)
  }, text)
}

/** Wait until session notes in localStorage contain substring. */
export async function waitForNotesPersisted(page: Page, substring: string): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate((sub) => {
        const raw = localStorage.getItem('notes_sessions') ?? '[]'
        return raw.includes(sub)
      }, substring),
    )
    .toBe(true)
}

/** Wait for debounced line? / ?? trigger (~400ms). */
export async function waitForNotesTrigger(page: Page): Promise<void> {
  await page.waitForTimeout(500)
}

/** Wait until lookup stream finishes and follow-up input is ready. */
export async function waitForLookupComplete(page: Page): Promise<void> {
  await expect(page.getByTestId('notes-side-panel')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('notes-side-panel')).toContainText('E2E mock answer', { timeout: 15_000 })
  await expect(page.getByTestId('notes-ai-active-count')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByTestId('notes-followup-input')).toBeVisible({ timeout: 5000 })
}

export const SESSIONS_KEY = 'notes_sessions'
export const LEGACY_SESSIONS_KEY = 'uvimco_notes_sessions'
