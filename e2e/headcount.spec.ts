/** Headcount: the party plays as room cards, a reload resumes it, and the archive marks finished parties. */

import { test, expect } from '@playwright/test'
import party from '../data/headcount/2026-11-26.json'
import { shiftDay, siteDay } from '../src/lib/daily'
import { mockSyncIdentity } from './helpers/sync-identity-mock'

test('rooms play as cards, resume after a reload and show in the archive', async ({ page }) => {
  await mockSyncIdentity(page)
  const day = siteDay()
  const past = shiftDay(day, -1)
  await page.route('**/api/results**', (r) => r.fulfill({ json: { rows: [], result: null } }))
  await page.route('**/api/daily/headcount**', (r) => {
    const d = new URL(r.request().url()).searchParams.get('d') ?? day
    return r.fulfill({ json: { day: d, sourceDate: d, puzzle: { ...party, date: d } } })
  })

  await page.goto('/games/headcount')
  const kitchen = page.getByRole('region', { name: 'Kitchen' })
  await expect(kitchen).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('region', { name: 'Living Room' })).toContainText('Opens after the room before it.')
  await kitchen.getByRole('button', { name: 'Lock in' }).click()
  await expect(kitchen).toContainText('Yes 44% · No 56%')
  await expect(kitchen).toContainText('/20')
  const total = await page.getByTestId('headcount-total').textContent()

  await page.reload()
  await expect(page.getByRole('region', { name: 'Living Room' }).getByRole('button', { name: 'Lock in' })).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.getByTestId('headcount-total')).toHaveText(total ?? '')

  await page.evaluate(
    ([key]) => localStorage.setItem(key!, JSON.stringify([[50], [0, 1, 2, 3], [1], [0], [100, 0, 0, 0]])),
    [`headcount:v1:${past}:${past}`],
  )
  await page.goto('/games/headcount/archive')
  const archive = page.getByTestId('headcount-archive').or(page.getByTestId('headcount-archive-empty'))
  await expect(archive).toBeVisible({ timeout: 25_000 })
  if (past >= '2026-11-26') await expect(page.getByRole('img', { name: `${past}: Completed` })).toBeVisible()
})
