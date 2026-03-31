import type { Page } from '@playwright/test'

type ClickOpts = { tap?: boolean }

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
