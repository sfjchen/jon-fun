/**
 * Shared mock for the sync identity endpoint used by Daily Learn and Notes, and for the device state mirror.
 */
import type { Page } from '@playwright/test'

/**
 * Stubs GET/POST `/api/sync/identity` (GET restores nothing and POST echoes the key) and `/api/sync/state`, which
 * stores and returns nothing, so specs leave no rows behind.
 */
export async function mockSyncIdentity(page: Page): Promise<void> {
  await page.route('**/api/sync/identity', async (route) => {
    const req = route.request()
    const body =
      req.method() === 'POST'
        ? { syncKey: (req.postDataJSON() as { syncKey?: string }).syncKey ?? '' }
        : { syncKey: '', deviceId: '' }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/api/sync/state', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], since: '', more: false }),
    }),
  )
}
