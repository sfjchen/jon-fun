import { expect, type Page } from '@playwright/test'

type ClickOpts = { tap?: boolean }

/** After `goto` MOC URL: wait for client mount, intro → calibrate → play. */
export async function mocStartFromIntro(page: Page, opts?: { tap?: boolean }): Promise<void> {
  await page.waitForLoadState('load')
  const cont = page.getByTestId('moc-intro-continue')
  await expect(cont).toBeEnabled({ timeout: 25_000 })
  if (opts?.tap) await cont.tap()
  else await cont.click()
  await expect(page.getByTestId('moc-start-course')).toBeVisible({ timeout: 20_000 })
  const start = page.getByTestId('moc-start-course')
  if (opts?.tap) await start.tap()
  else await start.click()
}

/**
 * Mental Obstacle Course: logic/trivia buttons. On Mobile Chrome use `tap: true`
 * (mouse-style clicks can stall in "performing click action" on touch emulation).
 */
export async function domClickTestId(page: Page, testId: string, opts?: ClickOpts): Promise<void> {
  const loc = page.locator(`[data-testid="${testId}"]`).first()
  await loc.waitFor({ state: 'visible', timeout: 15_000 })
  if (opts?.tap) {
    await loc.tap()
  } else {
    await loc.click({ force: true, noWaitAfter: true, timeout: 15_000 })
  }
}
