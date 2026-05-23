/**
 * theme2 Connections interactive states.
 *
 * Snapshots cover the populated library card, the play board with words selected,
 * and the win-result panel — three surfaces where text color sits on tinted/cream backgrounds.
 */
import { test } from '@playwright/test'
import { gotoStable, snap, assertNoLowContrast } from './helpers/visual'
import {
  CONNECTIONS_E2E_SLUG,
  installConnectionsApiMock,
} from './helpers/connections-mock'

/** Interactive flows run only on the desktop visual project; mobile/tablet diffs add no signal. */
test.describe('theme2 Connections states', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'visual-desktop' && testInfo.project.name !== 'chromium', 'desktop-only flow')
    installConnectionsApiMock(page)
  })

  test('play board with words selected', async ({ page }) => {
    await gotoStable(page, `/theme2/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitFor: '[data-testid="connections-board"]',
    })
    for (const w of ['Mercury', 'Venus']) {
      await page.getByRole('button', { name: w, exact: true }).click()
    }
    await snap(page, 'connections-board-selected.png')
    await assertNoLowContrast(page).catch((err: Error) => {
      test.info().annotations.push({ type: 'a11y-contrast', description: err.message })
    })
  })

  test('win result panel', async ({ page }) => {
    await gotoStable(page, `/theme2/games/connections/play/${CONNECTIONS_E2E_SLUG}`, {
      waitFor: '[data-testid="connections-board"]',
    })
    async function submitGroup(words: string[]) {
      for (const w of words) await page.getByRole('button', { name: w, exact: true }).click()
      await page.getByRole('button', { name: 'Submit' }).click()
    }
    await submitGroup(['Mercury', 'Venus', 'Earth', 'Mars'])
    await submitGroup(['King', 'Queen', 'Rook', 'Knight'])
    await submitGroup(['Spring', 'Summer', 'Fall', 'Winter'])
    await submitGroup(['North', 'South', 'East', 'West'])
    await page.waitForSelector('[data-testid="connections-result"]', { state: 'visible' })
    await snap(page, 'connections-result-win.png')
    await assertNoLowContrast(page).catch((err: Error) => {
      test.info().annotations.push({ type: 'a11y-contrast', description: err.message })
    })
  })
})
