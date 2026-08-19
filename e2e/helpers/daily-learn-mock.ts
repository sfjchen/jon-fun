import type { Page } from '@playwright/test'

export type MockDailyLearnEntry = { date: string; text: string; updatedAt: string }

const STORE_KEY = '__dailyLearnMockStore__'

function ensureStoreScript(): string {
  return `
    (() => {
      const k = ${JSON.stringify(STORE_KEY)};
      const w = window;
      if (!w[k]) w[k] = new Map();
    })();
  `
}

/** Seed or replace mock server rows for a user id (defaults to effective device id after page load). */
export async function setDailyLearnMockServerEntries(
  page: Page,
  entries: MockDailyLearnEntry[],
  userId?: string,
): Promise<void> {
  const uid =
    userId ??
    (await page.evaluate(() => localStorage.getItem('daily_learn_sync_key') || localStorage.getItem('daily_learn_user_id') || 'default'))
  await page.evaluate(
    ({ storeKey, uid, rows }) => {
      const w = window as Window & { [key: string]: Map<string, MockDailyLearnEntry[]> | undefined }
      if (!w[storeKey]) w[storeKey] = new Map()
      w[storeKey]!.set(uid, rows)
    },
    { storeKey: STORE_KEY, uid, rows: entries },
  )
}

/** Avoid flaky E2E when Supabase/env is absent — stub daily-learn sync routes with in-memory store. */
export async function mockDailyLearnApi(
  page: Page,
  opts?: { serverEntries?: MockDailyLearnEntry[] },
): Promise<void> {
  await page.addInitScript(
    ({ storeKey, initialEntries }: { storeKey: string; initialEntries: MockDailyLearnEntry[] }) => {
      const w = window as Window & { [key: string]: Map<string, MockDailyLearnEntry[]> | undefined }
      if (!w[storeKey]) w[storeKey] = new Map()
      if (initialEntries.length > 0) w[storeKey]!.set('default', initialEntries)
    },
    { storeKey: STORE_KEY, initialEntries: opts?.serverEntries ?? [] },
  )

  await page.route('**/api/daily-learn/**', async (route) => {
    const req = route.request()
    const method = req.method()
    if (method === 'GET') {
      const url = new URL(req.url())
      const userId = url.searchParams.get('userId') ?? 'default'
      const frame = route.request().frame()
      const entries = frame
        ? await frame.evaluate(
            ({ storeKey, uid }) => {
              const w = window as Window & { [key: string]: Map<string, MockDailyLearnEntry[]> | undefined }
              return w[storeKey]?.get(uid) ?? []
            },
            { storeKey: STORE_KEY, uid: userId },
          )
        : []
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries }),
      })
      return
    }
    if (method === 'POST') {
      const body = req.postDataJSON() as {
        userId?: string
        entries?: Array<{ date: string; text: string }>
      }
      const userId = body.userId ?? 'default'
      const incoming = Array.isArray(body.entries) ? body.entries : []
      const frame = route.request().frame()
      if (frame) {
        await frame.evaluate(
          ({ storeKey, uid, rows }) => {
            const w = window as Window & { [key: string]: Map<string, MockDailyLearnEntry[]> | undefined }
            if (!w[storeKey]) w[storeKey] = new Map()
            const list = [...(w[storeKey]!.get(uid) ?? [])]
            for (const row of rows) {
              const text = (row.text ?? '').trim()
              if (!text) continue
              const updatedAt = new Date().toISOString()
              const idx = list.findIndex((x) => x.date === row.date)
              const entry = { date: row.date, text, updatedAt }
              if (idx >= 0) list[idx] = entry
              else list.push(entry)
            }
            w[storeKey]!.set(uid, list)
          },
          { storeKey: STORE_KEY, uid: userId, rows: incoming },
        )
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }
    await route.continue()
  })

  await page.evaluate(ensureStoreScript())
}

/** Simulate tab hidden → visible to trigger background sync in DailyLearnManager. */
export async function triggerDailyLearnTabVisible(page: Page): Promise<void> {
  await page.evaluate(() => {
    let state: DocumentVisibilityState = 'hidden'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    })
    state = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    state = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
  })
}
