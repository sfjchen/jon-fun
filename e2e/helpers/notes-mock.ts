import { expect, type Page, Locator } from '@playwright/test'

/** Tiptap ProseMirror content area. */
export function notesEditor(page: Page): Locator {
  return page.locator('[data-testid="notes-tiptap-editor"] .ProseMirror')
}

/** Wait for Tiptap editor to mount (retries once after reload on slow dev compiles). */
export async function waitForNotesEditor(page: Page): Promise<void> {
  await page.getByTestId('notes-loading').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
  try {
    await page.waitForSelector('[data-testid="notes-tiptap-editor"] .ProseMirror', { timeout: 25_000 })
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('notes-loading').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
    await page.waitForSelector('[data-testid="notes-tiptap-editor"] .ProseMirror', { timeout: 25_000 })
  }
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
      'data: {"token":"TVPI\\n\\nTotal value to paid-in — ratio of current NAV plus distributions to capital called. E2E mock answer."}\n\n' +
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

/** Type into the active notes editor (fires ProseMirror onUpdate). */
export async function typeInNotesEditor(page: Page, text: string): Promise<void> {
  await waitForNotesEditor(page)
  const editor = notesEditor(page)
  await editor.click()
  await page.keyboard.type(text)
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

/** Insert CSV via `?notesE2e=1` hook (Playwright cannot synthesize file drop reliably). */
export async function dropCsvOnNotesEditor(
  page: Page,
  csv: string,
  filename = 'positions.csv',
): Promise<void> {
  await waitForNotesEditor(page)
  await notesEditor(page).click()
  const ok = await page.evaluate(
    async ({ csv, filename }) => {
      const fn = (window as Window & { __notesE2eInsertCsv?: (csv: string, name?: string) => Promise<boolean> })
        .__notesE2eInsertCsv
      if (!fn) return false
      return fn(csv, filename)
    },
    { csv, filename },
  )
  if (!ok) throw new Error('notesE2e CSV insert failed — use /games/notes?notesE2e=1')
}

/** Seed a session with a spreadsheet attachment (deploy-safe smoke without file drop). */
export async function seedSpreadsheetAttachmentSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    const id = 'sheet-e2e-restore'
    const csv = 'Ticker,Price\nAAPL,190\nMSFT,420'
    const base64 = btoa(csv)
    const session = {
      id: 'attach-sheet-restore',
      title: 'Sheet restore',
      notes: `[📎 ${id}]`,
      tags: [],
      metadata: {},
      lookups: [],
      screenshots: {
        [id]: {
          id,
          base64,
          mimeType: 'text/csv',
          kind: 'spreadsheet',
          filename: 'positions.csv',
          preview: {
            sheetName: 'positions',
            headers: ['Ticker', 'Price'],
            rows: [['AAPL', '190'], ['MSFT', '420']],
            totalRows: 2,
            totalCols: 2,
          },
          display: { widthPx: 560, heightPx: 280 },
        },
      },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('notes_sessions', JSON.stringify([session]))
    localStorage.setItem('notes_active_session_id', session.id)
  })
}

/** Side-panel content (vault rows, sync) only mounts when the panel is open. */
export async function ensureNotesPanelOpen(page: Page): Promise<void> {
  const panel = page.getByTestId('notes-side-panel')
  if (!(await panel.isVisible())) {
    await page.getByTestId('notes-toggle-panel').click()
  }
  await expect(panel).toBeVisible()
}

/** Fail when the page body scrolls horizontally (layout overflow). */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(2)
}
