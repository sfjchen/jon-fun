import type { Page } from '@playwright/test'

export type MockDailyLearnEntry = { date: string; text: string; updatedAt: string }

/** Mock server rows per page, keyed by user id. Lives in Node so it survives reloads like a real server. */
const stores = new WeakMap<Page, Map<string, MockDailyLearnEntry[]>>()

/** Seed or replace mock server rows for a user id (defaults to effective device id after page load). */
export async function setDailyLearnMockServerEntries(
  page: Page,
  entries: MockDailyLearnEntry[],
  userId?: string,
): Promise<void> {
  const uid =
    userId ??
    (await page.evaluate(() => localStorage.getItem('daily_learn_sync_key') || localStorage.getItem('daily_learn_user_id') || 'default'))
  stores.get(page)?.set(uid, entries)
}

/** Stubs daily-learn sync routes with an in-memory store that mirrors the server's newest-updatedAt-wins rule. */
export async function mockDailyLearnApi(
  page: Page,
  opts?: { serverEntries?: MockDailyLearnEntry[] },
): Promise<void> {
  const store = new Map<string, MockDailyLearnEntry[]>()
  if (opts?.serverEntries?.length) store.set('default', opts.serverEntries)
  stores.set(page, store)

  await page.route('**/api/daily-learn/**', async (route) => {
    const req = route.request()
    const method = req.method()
    if (method === 'GET') {
      const userId = new URL(req.url()).searchParams.get('userId') ?? 'default'
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: store.get(userId) ?? [] }) })
      return
    }
    if (method === 'POST') {
      const body = req.postDataJSON() as {
        userId?: string
        entries?: Array<{ date: string; text: string; updatedAt?: string }>
      }
      const userId = body.userId ?? 'default'
      const list = [...(store.get(userId) ?? [])]
      for (const row of Array.isArray(body.entries) ? body.entries : []) {
        const ms = Math.min(Date.parse(row.updatedAt ?? '') || 0, Date.now())
        const idx = list.findIndex((x) => x.date === row.date)
        const cur = idx >= 0 ? Date.parse(list[idx]!.updatedAt) || 0 : -1
        if (!ms || ms <= cur) continue
        const entry = { date: row.date, text: (row.text ?? '').trim(), updatedAt: new Date(ms).toISOString() }
        if (idx >= 0) list[idx] = entry
        else list.push(entry)
      }
      store.set(userId, list)
    }
    if (method === 'POST' || method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    await route.continue()
  })
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
