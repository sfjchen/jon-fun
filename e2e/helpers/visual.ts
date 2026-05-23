/**
 * Visual-regression + accessibility helpers for theme2 stress tests.
 *
 * `gotoStable` deflakes screenshots by:
 *  - waiting for networkidle + DOM ready
 *  - killing animations/transitions/caret blink
 *  - awaiting font load (document.fonts.ready) — Patrick Hand / Charter swap is the #1 flake source here
 */
import { expect, type Page, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const STABILIZE_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
html, body { scroll-behavior: auto !important; }
`

export async function gotoStable(page: Page, url: string, opts: { waitFor?: string } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { state: 'visible' }).catch(() => undefined)
  await page.evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
  // settle one paint frame
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
}

export async function snap(
  page: Page,
  name: string,
  opts: { mask?: Locator[]; fullPage?: boolean } = {},
) {
  await expect(page).toHaveScreenshot(name, {
    fullPage: opts.fullPage ?? true,
    mask: opts.mask,
    animations: 'disabled',
    caret: 'hide',
  })
}

/**
 * Run axe-core against the current page and surface only color-contrast failures.
 * Other a11y rules would generate noise across an existing codebase; we narrow to the visual bug class we care about.
 */
export async function assertNoLowContrast(page: Page) {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze()
  if (results.violations.length === 0) return
  const summary = results.violations
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[0] ?? ''}`))
    .join('\n')
  throw new Error(`Color-contrast violations on ${page.url()}:\n${summary}`)
}
