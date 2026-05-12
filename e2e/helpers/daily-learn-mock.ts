import type { Page } from '@playwright/test'

/** Avoid flaky E2E when Supabase/env is absent — stub daily-learn sync routes. */
export async function mockDailyLearnApi(page: Page): Promise<void> {
  await page.route('**/api/daily-learn/**', async (route) => {
    const req = route.request()
    const method = req.method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries: [] }),
      })
      return
    }
    if (method === 'POST') {
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
}
