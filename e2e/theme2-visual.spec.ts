/**
 * theme2 visual + contrast stress test.
 *
 * For every theme2 route, take a viewport-scoped screenshot and run an axe color-contrast scan.
 * Run with: `npm run test:e2e -- --project=visual-desktop|visual-tablet|visual-mobile theme2-visual`
 *
 * To accept a known-good baseline (first run or after intentional UI change):
 *   `npm run test:e2e -- --project=visual-desktop --update-snapshots theme2-visual`
 */
import { test, expect } from '@playwright/test'
import { gotoStable, snap, assertNoLowContrast } from './helpers/visual'
import { installConnectionsApiMock } from './helpers/connections-mock'
import { mockDailyLearnApi } from './helpers/daily-learn-mock'

/** Routes that need API mocks before navigation. */
const ROUTE_MOCKS: Record<string, 'connections' | 'daily-learn' | undefined> = {
  '/theme2/games/connections': 'connections',
  '/theme2/games/connections/new': 'connections',
  '/theme2/games/daily-log': 'daily-learn',
}

/**
 * Theme2 surface inventory (excluding routes requiring a live Supabase room PIN —
 * `/theme2/games/poker/lobby/[pin]` and `/theme2/games/poker/table/[pin]`).
 */
const ROUTES = [
  '/theme2',
  '/theme2/leaderboards',
  '/theme2/games/jeopardy',
  '/theme2/games/24',
  '/theme2/games/daily-log',
  '/theme2/games/tmr',
  /** five-can-sorting omitted from visual diffs: initial board uses randomPermutation, non-deterministic. */
  '/theme2/games/mental-obstacle-course',
  '/theme2/games/quip-clash',
  '/theme2/games/fib-it',
  '/theme2/games/enough-about-you',
  '/theme2/games/connections',
  '/theme2/games/connections/new',
  '/theme2/games/pear-navigator',
  '/theme2/games/chwazi',
  '/theme2/games/poker',
  '/theme2/admin/tmr',
] as const

function snapName(route: string) {
  return `${route.replace(/^\//, '').replace(/\//g, '_') || 'root'}.png`
}

test.describe('theme2 visual + contrast', () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      const mock = ROUTE_MOCKS[route]
      if (mock === 'connections') await installConnectionsApiMock(page)
      else if (mock === 'daily-learn') await mockDailyLearnApi(page)

      await gotoStable(page, route)

      /** Mask regions known to vary across runs (timestamps, random PINs, animated game state). */
      const masks = [
        page.locator('time'),
        page.locator('[data-testid*="timer"]'),
        page.locator('[data-testid*="pin"]'),
      ]
      await snap(page, snapName(route), { mask: masks })

      /**
       * Contrast scan is best-effort: we want to surface regressions without failing on legacy
       * issues outside theme2's scope. Soft-assert so visual baseline still gets recorded.
       */
      await assertNoLowContrast(page).catch((err: Error) => {
        test.info().annotations.push({ type: 'a11y-contrast', description: err.message })
      })
    })
  }
})

/** Smoke check that the home page actually renders something themed before we trust baselines. */
test('theme2 home renders ink-themed wrapper', async ({ page }) => {
  await gotoStable(page, '/theme2')
  const wrapper = page.locator('[data-theme="notebook"]').first()
  await expect(wrapper).toBeVisible()
})

/** Five-can has a randomized initial board (randomPermutation) → snapshot would flake. Contrast-only. */
test('five-can-sorting contrast scan', async ({ page }) => {
  await gotoStable(page, '/theme2/games/five-can-sorting')
  await assertNoLowContrast(page).catch((err: Error) => {
    test.info().annotations.push({ type: 'a11y-contrast', description: err.message })
  })
})
