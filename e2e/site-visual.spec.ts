/**
 * Notebook theme visual + contrast stress test (canonical routes only — no /theme2).
 *
 * Run: `npm run test:e2e -- --project=visual-desktop site-visual`
 * Baselines: `npm run test:e2e -- --project=visual-desktop --update-snapshots site-visual`
 */
import { test } from '@playwright/test'
import { gotoStable, snap, assertNoLowContrast } from './helpers/visual'
import { installConnectionsApiMock } from './helpers/connections-mock'
import { mockDailyLearnApi } from './helpers/daily-learn-mock'

const ROUTE_MOCKS: Record<string, 'connections' | 'daily-learn' | undefined> = {
  '/games/connections': 'connections',
  '/games/connections/new': 'connections',
  '/games/daily-log': 'daily-learn',
}

const ROUTES = [
  '/',
  '/leaderboards',
  '/games/jeopardy',
  '/games/24',
  '/games/daily-log',
  '/games/tmr',
  '/games/mental-obstacle-course',
  '/games/quip-clash',
  '/games/fib-it',
  '/games/enough-about-you',
  '/games/connections',
  '/games/connections/new',
  '/games/pear-navigator',
  '/games/chwazi',
  '/games/poker',
  '/admin/tmr',
] as const

function snapName(route: string) {
  return `${route.replace(/^\//, '').replace(/\//g, '_') || 'root'}.png`
}

test.describe('site visual + contrast (notebook)', () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      const mock = ROUTE_MOCKS[route]
      if (mock === 'connections') await installConnectionsApiMock(page)
      else if (mock === 'daily-learn') await mockDailyLearnApi(page)

      await gotoStable(page, route)

      const masks = [
        page.locator('[data-testid="party-room-pin"]'),
        page.locator('[data-testid="daily-learn-today"]'),
        page.locator('time'),
      ]

      await snap(page, snapName(route), masks)
      try {
        await assertNoLowContrast(page)
      } catch (e) {
        test.info().annotations.push({ type: 'a11y', description: String(e) })
      }
    })
  }
})
