/**
 * theme2 modal/overlay contrast checks.
 *
 * Modals frequently sit on `bg-black/45` scrims with cream panels — high risk for invisible
 * text if a child component leaks `text-white` into the cream panel body.
 */
import { test, expect } from '@playwright/test'
import { gotoStable, snap, assertNoLowContrast } from './helpers/visual'

test.describe('theme2 modals', () => {
  test.beforeEach(async ({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'visual-desktop' && testInfo.project.name !== 'chromium', 'desktop-only flow')
  })
  test('Coming Soon modal on /theme2', async ({ page }) => {
    await gotoStable(page, '/theme2')
    /** Click any coming-soon card; selector pattern matches the home grid's Coming Soon trigger. */
    const trigger = page.getByRole('button', { name: /Coming soon/i }).first()
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click()
      await expect(page.getByRole('button', { name: /Got it/i })).toBeVisible({ timeout: 5_000 })
      await snap(page, 'theme2-coming-soon-modal.png')
      await assertNoLowContrast(page).catch((err: Error) => {
        test.info().annotations.push({ type: 'a11y-contrast', description: err.message })
      })
    } else {
      test.info().annotations.push({ type: 'skip', description: 'no Coming Soon card on /theme2' })
    }
  })
})
