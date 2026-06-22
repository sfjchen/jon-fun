import type { Page } from '@playwright/test'

/** Stub UVIMCO Notes sync + lookup routes for offline E2E. */
export async function mockUvimcoNotesApi(page: Page): Promise<void> {
  await page.route('**/api/uvimco-notes/sessions**', async (route) => {
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

  await page.route('**/api/uvimco-notes/lookup', async (route) => {
    const body = `
data: ${JSON.stringify({ token: 'E2E mock answer for term lookup.' })}

data: [DONE]

`
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body,
    })
  })
}
