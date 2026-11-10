/**
 * Shared mock for the sync identity endpoint used by Daily Learn and Notes.
 */
import type { Page } from '@playwright/test'

/** Stubs GET/POST/PATCH `/api/sync/identity`. POST echoes the key and reports `approved` (default true). */
export async function mockSyncIdentity(page: Page, opts?: { approved?: boolean }): Promise<void> {
  const approved = opts?.approved ?? true
  await page.route('**/api/sync/identity', async (route) => {
    const method = route.request().method()
    let body: unknown = { syncKey: '', deviceId: '' }
    if (method === 'POST') {
      const req = route.request().postDataJSON() as { syncKey?: string }
      body = { syncKey: req.syncKey ?? '', approved, devices: [] }
    } else if (method === 'PATCH') body = { devices: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}
