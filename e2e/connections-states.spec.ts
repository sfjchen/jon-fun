/**
 * Connections interactive states on `/games/connections` (visual snapshots).
 */
import { test, expect } from '@playwright/test'
import { gotoStable, snap } from './helpers/visual'
import { CONNECTIONS_E2E_SLUG, installConnectionsApiMock } from './helpers/connections-mock'

test.describe('Connections visual states', () => {
  test.beforeEach(async ({ page }) => {
    await installConnectionsApiMock(page)
  })

  test('board with selection', async ({ page }) => {
    await gotoStable(page, `/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitFor: '[data-testid="connections-board"]',
    })
    await page.getByRole('button', { name: 'Mercury', exact: true }).click()
    await page.getByRole('button', { name: 'Venus', exact: true }).click()
    await page.getByRole('button', { name: 'Earth', exact: true }).click()
    await page.getByRole('button', { name: 'Mars', exact: true }).click()
    await snap(page, 'connections-board-selected.png')
  })

  test('win result', async ({ page }) => {
    await gotoStable(page, `/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitFor: '[data-testid="connections-board"]',
    })

    async function submitGroup(words: string[]) {
      for (const w of words) {
        await page.getByRole('button', { name: w, exact: true }).click()
      }
      await page.getByRole('button', { name: 'Submit' }).click()
    }

    await submitGroup(['Mercury', 'Venus', 'Earth', 'Mars'])
    await submitGroup(['King', 'Queen', 'Rook', 'Knight'])
    await submitGroup(['Spring', 'Summer', 'Fall', 'Winter'])
    await submitGroup(['North', 'South', 'East', 'West'])
    await expect(page.getByTestId('connections-result')).toBeVisible({ timeout: 15_000 })
    await snap(page, 'connections-result-win.png')
  })
})
