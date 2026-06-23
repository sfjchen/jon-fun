import type { Page } from '@playwright/test'

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
    const scores = excerpts.map((ex, i) => (ex.toLowerCase().includes(String(body.query ?? '').toLowerCase().slice(0, 4)) ? 0.9 - i * 0.05 : 0.2))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ scores, model: 'gemini-embedding-001' }),
    })
  })

  await page.route('**/api/notes/lookup', async (route) => {
    const body = `
data: ${JSON.stringify({ token: 'Core meaning\nE2E mock answer for term lookup.' })}

data: [DONE]

`
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body,
    })
  })
}

/** @deprecated use mockNotesApi */
export const mockUvimcoNotesApi = mockNotesApi

/** Wait for debounced line? / ?? trigger (~400ms). */
export async function waitForNotesTrigger(page: Page): Promise<void> {
  await page.waitForTimeout(500)
}

export const SESSIONS_KEY = 'notes_sessions'
export const LEGACY_SESSIONS_KEY = 'uvimco_notes_sessions'
